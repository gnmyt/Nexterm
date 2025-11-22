const { Router } = require("express");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const Session = require("../models/Session");
const Account = require("../models/Account");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { validateEntryAccess } = require("../controllers/entry");
const { getOrganizationAuditSettingsInternal } = require("../controllers/audit");
const { createSSH } = require("../utils/createSSH");
const logger = require("../utils/logger");

const app = Router();

app.get("/", async (req, res) => {
    const sessionToken = req.query["sessionToken"];
    const entryId = req.query["entryId"];
    const identityId = req.query["identityId"];
    const path = req.query["path"];
    const connectionReason = req.query["connectionReason"];

    if (!sessionToken) {
        res.status(400).send("You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!entryId) {
        res.status(400).send("You need to provide the entryId in the 'entryId' parameter");
        return;
    }

    if (!identityId) {
        res.status(400).send("You need to provide the identity in the 'identityId' parameter");
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

    const entry = await Entry.findByPk(entryId);
    if (entry === null) {
        res.status(404).send("The entry does not exist");
        return;
    }

    const accessCheck = await validateEntryAccess(req.user.id, entry);
    if (!accessCheck.valid) {
        res.status(403).send("You don't have access to this entry");
        return;
    }

    const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });

    if (entryIdentities.length === 0 && identityId) return;

    const identity = await Identity.findByPk(identityId || entryIdentities[0].identityId);
    if (identity === null) return;

    if (entry.organizationId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            res.status(400).json({ error: "Connection reason required", requireConnectionReason: true });
            return;
        }
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

    logger.system(`Authorized file download from ${entry.config.ip} with identity ${identity.name}`, {
        entryId: entry.id,
        identityId: identity.id,
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

                res.header("Content-Disposition", `attachment; filename="${path.split("/").pop()}"`);
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
                        connectionReason: connectionReason || null,
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                });
            });
        });
    });
});

module.exports = app;