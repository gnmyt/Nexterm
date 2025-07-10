const Session = require("../models/Session");
const Account = require("../models/Account");
const Server = require("../models/Server");
const Identity = require("../models/Identity");
const prepareSSH = require("./prepareSSH");
const { validateServerAccess } = require("../controllers/server");

const authenticateWS = async (ws, req, options = {}) => {
    const { requiredParams = ['sessionToken', 'serverId'] } = options;

    for (const param of requiredParams) {
        if (!req.query[param]) {
            const errorCode = param === 'sessionToken' ? 4001 : 
                            param === 'serverId' ? 4002 : 4009;
            ws.close(errorCode, `You need to provide the ${param} in the '${param}' parameter`);
            return null;
        }
    }

    const session = await Session.findOne({ where: { token: req.query.sessionToken } });
    if (!session) {
        ws.close(4003, "The token is not valid");
        return null;
    }

    await Session.update({ lastActivity: new Date() }, { where: { id: session.id } });

    const user = await Account.findByPk(session.accountId);
    if (!user) {
        ws.close(4004, "The token is not valid");
        return null;
    }

    const server = await Server.findByPk(req.query.serverId);
    if (!server) {
        ws.close(4006, "The server does not exist");
        return null;
    }

    const accessCheck = await validateServerAccess(user.id, server);
    if (!accessCheck.valid) {
        ws.close(4005, "You don't have access to this server");
        return null;
    }

    if (server.identities.length === 0) {
        ws.close(4007, "The server has no identities");
        return null;
    }

    const identity = await Identity.findByPk(JSON.parse(server.identities)[0]);
    if (!identity) {
        ws.close(4008, "The identity does not exist");
        return null;
    }

    const ssh = await prepareSSH(server, identity, ws);

    return { user, server, identity, ssh };
};

module.exports = { authenticateWS };
