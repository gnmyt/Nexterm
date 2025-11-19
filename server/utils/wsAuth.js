const Session = require("../models/Session");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const prepareSSH = require("./prepareSSH");
const { validateEntryAccess } = require("../controllers/entry");

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

    const entry = await Entry.findByPk(req.query.serverId);
    if (!entry) {
        ws.close(4006, "The entry does not exist");
        return null;
    }

    const accessCheck = await validateEntryAccess(user.id, entry);
    if (!accessCheck.valid) {
        ws.close(4005, "You don't have access to this entry");
        return null;
    }

    const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });
    if (entryIdentities.length === 0) {
        ws.close(4007, "The entry has no identities");
        return null;
    }

    const identity = await Identity.findByPk(entryIdentities[0].identityId);
    if (!identity) {
        ws.close(4008, "The identity does not exist");
        return null;
    }

    const ssh = await prepareSSH(entry, identity, ws);

    return { user, server: entry, entry, identity, ssh };
};

module.exports = { authenticateWS };
