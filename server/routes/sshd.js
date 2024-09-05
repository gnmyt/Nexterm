const Session = require("../models/Session");
const Account = require("../models/Account");
const Server = require("../models/Server");
const Identity = require("../models/Identity");
const prepareSSH = require("../utils/prepareSSH");

module.exports = async (ws, req) => {
    const authHeader = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    const identityId = req.query["identityId"];

    if (!authHeader) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!serverId) {
        ws.close(4002, "You need to provide the serverId in the 'serverId' parameter");
        return;
    }

    if (!identityId) {
        ws.close(4003, "You need to provide the identity in the 'identityId' parameter");
        return;
    }

    req.session = await Session.findOne({ where: { token: authHeader } });

    if (req.session === null) {
        ws.close(4003, "The token is not valid");
        return;
    }

    await Session.update({ lastActivity: new Date() }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null) {
        ws.close(4004, "The token is not valid");
        return;
    }

    const server = await Server.findByPk(serverId);
    if (server === null) return;

    if (server.identities.length === 0 && identityId) return;

    const identity = await Identity.findByPk(identityId || server.identities[0]);
    if (identity === null) return;

    const ssh = await prepareSSH(server, identity, ws);

    ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color" }, (err, stream) => {
            if (err) {
                ws.close(4008, err.message);
                return;
            }

            stream.on("close", () => ws.close());

            stream.on("data", (data) => ws.send(data.toString()));

            ws.on("message", (data) => {
                if (data.startsWith("\x01")) {
                    const [width, height] = data.substring(1).split(",").map(Number);
                    stream.setWindow(height, width);
                } else {
                    stream.write(data);
                }
            });

            ws.on("close", () => {
                stream.end();
                ssh.end();
            });
        });
    });
};
