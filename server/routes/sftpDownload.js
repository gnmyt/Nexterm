const { Router } = require("express");
const prepareSSH = require("../utils/prepareSSH");
const Server = require("../models/Server");
const Identity = require("../models/Identity");
const Session = require("../models/Session");
const Account = require("../models/Account");
const { validateServerAccess } = require("../controllers/server");

const app = Router();

app.get("/", async (req, res) => {
    const sessionToken = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    const identityId = req.query["identityId"];
    const path = req.query["path"];

    if (!sessionToken) {
        res.status(400).send("You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!serverId) {
        res.status(400).send("You need to provide the serverId in the 'serverId' parameter");
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

    const server = await Server.findByPk(serverId);
    if (server === null) {
        res.status(404).send("The server does not exist");
        return;
    }

    const accessCheck = await validateServerAccess(req.user.id, server);
    if (!accessCheck.valid) {
        res.status(403).send("You don't have access to this server");
        return;
    }

    if (server.identities.length === 0 && identityId) return;

    const identity = await Identity.findByPk(identityId || server.identities[0]);
    if (identity === null) return;

    const ssh = await prepareSSH(server, identity, null, res);

    if (!ssh) return;

    ssh.on("ready", () => {
        ssh.sftp((err, sftp) => {
            if (err) return;

            sftp.stat(path, (err, stats) => {
                if (err) {
                    res.status(404).send("The file does not exist");
                    return;
                }

                res.header("Content-Disposition", `attachment; filename="${path.split("/").pop()}"`);
                res.header("Content-Length", stats.size);

                const readStream = sftp.createReadStream(path);
                readStream.pipe(res);
            });
        });
    });

    ssh.on("error", () => {
        res.status(500).send("This file cannot be downloaded");
    });
});

module.exports = app;