const { Router } = require("express");
const Session = require("../models/Session");
const Account = require("../models/Account");
const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const Identity = require("../models/Identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { createSSH } = require("../utils/createSSH");
const { addFolderToArchive } = require("../utils/sftpHelpers");
const logger = require("../utils/logger");
const archiver = require("archiver");

const app = Router();

const cleanup = (ssh) => {
    ssh.end();
    if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
};

app.get("/", async (req, res) => {
    const { sessionToken, sessionId, path: remotePath, preview } = req.query;

    if (!sessionToken) return res.status(400).send("Missing 'sessionToken' parameter");
    if (!sessionId) return res.status(400).send("Missing 'sessionId' parameter");
    if (!remotePath) return res.status(400).send("Missing 'path' parameter");

    const session = await Session.findOne({ where: { token: sessionToken } });
    if (!session) return res.status(400).send("Invalid token");

    await Session.update({ lastActivity: new Date() }, { where: { id: session.id } });

    const user = await Account.findByPk(session.accountId);
    if (!user) return res.status(400).send("Invalid token");

    const serverSession = SessionManager.get(sessionId);
    if (!serverSession) return res.status(404).send("Session not found");
    if (serverSession.accountId !== user.id) return res.status(403).send("Unauthorized");

    const entry = await Entry.findByPk(serverSession.entryId);
    if (!entry) return res.status(404).send("Entry not found");

    const identity = serverSession.configuration?.identityId
        ? await Identity.findByPk(serverSession.configuration.identityId)
        : null;

    const { ssh, sshOptions } = await createSSH(entry, identity, {}, user.id);

    ssh.on("error", () => {
        cleanup(ssh);
        if (!res.headersSent) res.status(500).send("Connection error");
    });

    try {
        ssh.connect(sshOptions);
    } catch (err) {
        cleanup(ssh);
        return res.status(500).send(err.message);
    }

    logger.system(`Authorized download from ${entry.config.ip}`, {
        entryId: entry.id, identityId: identity?.id, username: user.username, path: remotePath
    });

    ssh.on("ready", () => {
        ssh.sftp(async (err, sftp) => {
            if (err) {
                cleanup(ssh);
                return res.status(500).send("SFTP connection failed");
            }

            sftp.stat(remotePath, async (err, stats) => {
                if (err) {
                    cleanup(ssh);
                    return res.status(404).send("Path does not exist");
                }

                const fileName = remotePath.split("/").pop();
                const activeStreams = [];

                let cleaned = false;
                const cleanupAll = () => {
                    if (cleaned) return;
                    cleaned = true;
                    activeStreams.forEach(s => s.destroy?.());
                    cleanup(ssh);
                };

                req.on("close", () => { if (!res.writableEnded) cleanupAll(); });

                if (stats.isDirectory()) {
                    try {
                        res.header("Content-Disposition", `attachment; filename="${fileName}.zip"`);
                        res.header("Content-Type", "application/zip");

                        const archive = archiver("zip", { zlib: { level: 5 } });
                        activeStreams.push(archive);

                        archive.on("error", (err) => {
                            logger.error("Archive error", { error: err.message, path: remotePath });
                            archive.abort();
                            cleanupAll();
                        });

                        archive.on("end", () => cleanupAll());
                        archive.pipe(res);

                        await addFolderToArchive(sftp, remotePath, archive, fileName, activeStreams);
                        archive.finalize();

                        createAuditLog({
                            accountId: user.id,
                            organizationId: entry.organizationId,
                            action: AUDIT_ACTIONS.FOLDER_DOWNLOAD,
                            resource: RESOURCE_TYPES.FOLDER,
                            details: { folderPath: remotePath, connectionReason: serverSession.connectionReason || null },
                            ipAddress: req.ip,
                            userAgent: req.headers["user-agent"],
                        });
                    } catch (err) {
                        logger.error("Folder download error", { error: err.message, path: remotePath });
                        cleanupAll();
                        if (!res.headersSent) res.status(500).send("Download failed");
                    }
                } else {
                    res.header("Content-Disposition", `${preview === "true" ? "inline" : "attachment"}; filename="${fileName}"`);
                    res.header("Content-Length", stats.size);

                    const readStream = sftp.createReadStream(remotePath);
                    activeStreams.push(readStream);
                    readStream.pipe(res);

                    readStream.on("end", () => cleanupAll());
                    readStream.on("error", () => {
                        cleanupAll();
                        if (!res.headersSent) res.status(500).send("Read failed");
                    });

                    createAuditLog({
                        accountId: user.id,
                        organizationId: entry.organizationId,
                        action: AUDIT_ACTIONS.FILE_DOWNLOAD,
                        resource: RESOURCE_TYPES.FILE,
                        details: { filePath: remotePath, fileSize: stats.size, connectionReason: serverSession.connectionReason || null },
                        ipAddress: req.ip,
                        userAgent: req.headers["user-agent"],
                    });
                }
            });
        });
    });
});

module.exports = app;