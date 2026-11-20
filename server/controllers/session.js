const { Op } = require("sequelize");
const Session = require("../models/Session");
const Account = require("../models/Account");
const { getSessionRetentionCutoff, teardownLoginSession } = require("../utils/sessionCleanup");
const { IMPERSONATION_LIFETIME_MS } = require("../utils/loginSession");

module.exports.listSessions = async (accountId, currentSessionId) => {
    const cutoff = getSessionRetentionCutoff();

    return (await Session.findAll({ where: { accountId, lastActivity: { [Op.gte]: cutoff } } }))
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .map(session => ({ id: session.id, ip: session.ip, userAgent: session.userAgent, lastActivity: session.lastActivity,
            current: session.id === currentSessionId }));
}

module.exports.createSession = async (accountId, userAgent) => {
    const account = await Account.findByPk(accountId);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    const session = await Session.create({
        accountId, ip: "Admin", userAgent, expiresAt: new Date(Date.now() + IMPERSONATION_LIFETIME_MS),
    });

    return { token: session.token };
}

module.exports.destroySession = async (accountId, sessionId) => {
    const session = await Session.findOne({ where: { accountId, id: sessionId } });

    if (session === null)
        return { code: 206, message: "The provided session does not exist" };

    await Session.destroy({ where: { accountId, id: session.id } });
    await teardownLoginSession(session.id);

    return { message: "The session has been successfully destroyed" };
};