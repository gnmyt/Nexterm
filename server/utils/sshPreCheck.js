const Session = require("../models/Session");
const Account = require("../models/Account");
const Server = require("../models/Server");
const Identity = require("../models/Identity");
const prepareSSH = require("./prepareSSH");

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

    const server = await Server.findOne({ where: { id: serverId, accountId: req.user.id } });
    if (server === null) return;

    if (server.identities.length === 0 && identityId) return;

    const identity = await Identity.findByPk(identityId || server.identities[0]);
    if (identity === null) return;

    return prepareSSH(server, identity, ws);
}