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
const sharp = require("sharp");

const app = Router();

const THUMBNAIL_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024; // 10MB

const getExt = (path) => path.split(".").pop()?.toLowerCase();
const canThumbnail = (path, size) => THUMBNAIL_EXTENSIONS.has(getExt(path)) && size <= MAX_THUMBNAIL_SIZE;

const cleanup = (ssh) => {
    ssh.end();
    ssh._jumpConnections?.forEach(c => c.ssh.end());
};

const sftpConnect = (ssh) => new Promise((resolve, reject) => {
    ssh.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
});

const sftpStat = (sftp, path) => new Promise((resolve, reject) => {
    sftp.stat(path, (err, stats) => err ? reject(err) : resolve(stats));
});

app.get("/", async (req, res) => {
    const { sessionToken, sessionId, path: remotePath, preview, thumbnail, size } = req.query;
    if (!sessionToken || !sessionId || !remotePath) {
        return res.status(400).send("Missing required parameters");
    }

    const thumbSize = Math.min(Math.max(parseInt(size) || 100, 50), 300);

    const session = await Session.findOne({ where: { token: sessionToken } });
    if (!session) return res.status(400).send("Invalid token");
    
    const [user, serverSession] = await Promise.all([
        Account.findByPk(session.accountId),
        Session.update({ lastActivity: new Date() }, { where: { id: session.id } }).then(() => SessionManager.get(sessionId))
    ]);

    if (!user) return res.status(400).send("Invalid token");
    if (!serverSession) return res.status(404).send("Session not found");
    if (serverSession.accountId !== user.id) return res.status(403).send("Unauthorized");

    const entry = await Entry.findByPk(serverSession.entryId);
    if (!entry) return res.status(404).send("Entry not found");

    const identity = serverSession.configuration?.identityId 
        ? await Identity.findByPk(serverSession.configuration.identityId) : null;

    const { ssh, sshOptions } = await createSSH(entry, identity, {}, user.id);
    const streams = [];
    let cleaned = false;

    const cleanupAll = () => {
        if (cleaned) return;
        cleaned = true;
        streams.forEach(s => s.destroy?.());
        cleanup(ssh);
    };

    req.on("close", () => !res.writableEnded && cleanupAll());
    ssh.on("error", () => { cleanupAll(); !res.headersSent && res.status(500).send("Connection error"); });

    try {
        ssh.connect(sshOptions);
    } catch (err) {
        cleanup(ssh);
        return res.status(500).send(err.message);
    }

    ssh.on("ready", async () => {
        try {
            const sftp = await sftpConnect(ssh);
            const stats = await sftpStat(sftp, remotePath);
            const fileName = remotePath.split("/").pop();

            logger.system(`Authorized download from ${entry.config.ip}`, {
                entryId: entry.id, identityId: identity?.id, username: user.username, path: remotePath
            });

            if (stats.isDirectory()) {
                res.header("Content-Disposition", `attachment; filename="${fileName}.zip"`);
                res.header("Content-Type", "application/zip");

                const archive = archiver("zip", { zlib: { level: 5 } });
                streams.push(archive);
                archive.on("error", () => { archive.abort(); cleanupAll(); });
                archive.on("end", cleanupAll);
                archive.pipe(res);

                await addFolderToArchive(sftp, remotePath, archive, fileName, streams);
                archive.finalize();

                createAuditLog({
                    accountId: user.id, organizationId: entry.organizationId,
                    action: AUDIT_ACTIONS.FOLDER_DOWNLOAD, resource: RESOURCE_TYPES.FOLDER,
                    details: { folderPath: remotePath, connectionReason: serverSession.connectionReason || null },
                    ipAddress: req.ip, userAgent: req.headers["user-agent"],
                });
                return;
            }

            if (thumbnail === "true" && canThumbnail(remotePath, stats.size)) {
                res.header("Content-Type", "image/jpeg");
                res.header("Cache-Control", "public, max-age=3600");

                const readStream = sftp.createReadStream(remotePath);
                const transform = sharp().resize(thumbSize, thumbSize, { fit: "cover" }).jpeg({ quality: 80 });
                streams.push(readStream, transform);

                readStream.pipe(transform).pipe(res);
                transform.on("end", cleanupAll);
                transform.on("error", () => { cleanupAll(); !res.headersSent && res.status(500).send("Thumbnail failed"); });
                readStream.on("error", () => { cleanupAll(); !res.headersSent && res.status(500).send("Read failed"); });
                return;
            }

            res.header("Content-Disposition", `${preview === "true" ? "inline" : "attachment"}; filename="${fileName}"`);
            res.header("Content-Length", stats.size);

            const readStream = sftp.createReadStream(remotePath);
            streams.push(readStream);
            readStream.pipe(res);
            readStream.on("end", cleanupAll);
            readStream.on("error", () => { cleanupAll(); !res.headersSent && res.status(500).send("Read failed"); });

            createAuditLog({
                accountId: user.id, organizationId: entry.organizationId,
                action: AUDIT_ACTIONS.FILE_DOWNLOAD, resource: RESOURCE_TYPES.FILE,
                details: { filePath: remotePath, fileSize: stats.size, connectionReason: serverSession.connectionReason || null },
                ipAddress: req.ip, userAgent: req.headers["user-agent"],
            });
        } catch (err) {
            cleanupAll();
            if (!res.headersSent) res.status(err.code === "ENOENT" ? 404 : 500).send(err.message || "Download failed");
        }
    });
});

module.exports = app;