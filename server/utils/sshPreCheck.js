const Session = require("../models/Session");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const prepareSSH = require("./prepareSSH");
const { validateEntryAccess } = require("../controllers/entry");

module.exports = async (ws, req) => {
    const authHeader = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    const identityId = req.query["identityId"];
    const connectionReason = req.query["connectionReason"];

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

    const entry = await Entry.findByPk(serverId);
    if (entry === null) return;

    if (!((await validateEntryAccess(req.user.id, entry)).valid)) {
        ws.close(4005, "You don't have access to this entry");
        return;
    }

    const entryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, order: [['isDefault', 'DESC']] });
    const defaultIdentityId = entryIdentities.length > 0 ? entryIdentities[0].identityId : null;
    const identity = await Identity.findByPk(identityId || defaultIdentityId);
    if (identity === null) return;

    const userInfo = {
        accountId: req.user.id,
        ip: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        connectionReason: connectionReason || null
    };

    req.server = entry;

    return await prepareSSH(entry, identity, ws, null, userInfo);
}