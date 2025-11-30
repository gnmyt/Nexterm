const { Router } = require("express");
const Session = require("../models/Session");
const Account = require("../models/Account");
const SessionManager = require("../lib/SessionManager");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { createSSH } = require("../utils/createSSH");
const logger = require("../utils/logger");

const app = Router();

app.get("/", async (req, res) => {
    const sessionToken = req.query["sessionToken"];
    const sessionId = req.query["sessionId"];
    const path = req.query["path"];

    if (!sessionToken) {
        res.status(400).send("You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!sessionId) {
        res.status(400).send("You need to provide the sessionId in the 'sessionId' parameter");
        return;
    }

    if (!path) {
        res.status(400).send("You need to provide the path in the 'path' parameter");
        return;
    }

    req.session = await Session.findOne({ where: { token: sessionToken } });

    if (req.session === null) {
        res.status(400).send("The token is not valid");
        return;
    }

    await Session.update({ lastActivity: new Date() }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null) {
        res.status(400).send("The token is not valid");
        return;
    }

    const serverSession = SessionManager.get(sessionId);
    if (!serverSession) {
        res.status(404).send("Session not found");
        return;
    }

    if (serverSession.accountId !== req.user.id) {
        res.status(403).send("Unauthorized session access");
        return;
    }

    const Entry = require("../models/Entry");
    const Identity = require("../models/Identity");

    const entry = await Entry.findByPk(serverSession.entryId);
    if (!entry) {
        res.status(404).send("Entry not found");
        return;
    }

    let identity = null;
    if (serverSession.configuration?.identityId) {
        identity = await Identity.findByPk(serverSession.configuration.identityId);
    }

    const { ssh, sshOptions } = await createSSH(entry, identity);

    ssh.on("error", () => {
        if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
        res.status(500).send("This file cannot be downloaded");
    });

    try {
        ssh.connect(sshOptions);
    } catch (err) {
        if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
        res.status(500).send(err.message);
        return;
    }

    logger.system(`Authorized file download from ${entry.config.ip}${identity ? ` with identity ${identity.name}` : ''}`, {
        entryId: entry.id,
        identityId: identity?.id,
        username: req.user.username,
        path
    });

    ssh.on("ready", () => {
        ssh.sftp((err, sftp) => {
            if (err) return;

            sftp.stat(path, (err, stats) => {
                if (err) {
                    res.status(404).send("The file does not exist");
                    ssh.end();
                    if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
                    return;
                }

                const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';
                res.header("Content-Disposition", `${disposition}; filename="${path.split("/").pop()}"`);
                res.header("Content-Length", stats.size);

                const readStream = sftp.createReadStream(path);
                readStream.pipe(res);

                readStream.on('end', () => {
                    ssh.end();
                    if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
                });

                createAuditLog({
                    accountId: req.user.id,
                    organizationId: entry.organizationId,
                    action: AUDIT_ACTIONS.FILE_DOWNLOAD,
                    resource: RESOURCE_TYPES.FILE,
                    details: {
                        filePath: path,
                        fileSize: stats.size,
                        connectionReason: serverSession.connectionReason || null,
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                });
            });
        });
    });
});

module.exports = app;