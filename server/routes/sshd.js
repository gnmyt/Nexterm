const Session = require("../models/Session");
const Account = require("../models/Account");
const Server = require("../models/Server");
const Identity = require("../models/Identity");

const sshd = require("ssh2");

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

    let options;
    if (identity.type === "password") {
        options = {
            host: server.ip,
            port: server.port,
            username: identity.username,
            password: identity.password,
        };
    } else if (identity.type === "sshKey") {
        options = {
            host: server.ip,
            port: server.port,
            username: identity.username,
            privateKey: identity.sshKey,
            passphrase: identity.passphrase,
        };
    }

    console.log("Authorized connection to server " + server.ip + " with identity " + identity.name);

    const ssh = new sshd.Client();

    ssh.connect(options);

    ssh.on("error", (err) => {
        ws.close(4005, err.message);
    });

    ssh.on("end", () => {
        ws.close(4006, "Connection closed");
    });

    ssh.on("close", () => {
        ws.close(4007, "Connection closed");
    });

    ssh.on("keyboard-interactive", (name, instructions, instructionsLang, prompts, finish) => {
        finish([identity.password]);
    });

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
