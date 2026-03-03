const Session = require("../models/Session");
const Account = require("../models/Account");
const stateBroadcaster = require("../lib/StateBroadcaster");

module.exports.listSessions = async (accountId, currentSessionId) => {
    return (await Session.findAll({ where: { accountId } }))
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .map(session => ({ id: session.id, ip: session.ip, userAgent: session.userAgent, lastActivity: session.lastActivity,
            current: session.id === currentSessionId }));
}

module.exports.createSession = async (accountId, userAgent) => {
    const account = await Account.findByPk(accountId);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    const session = await Session.create({ accountId, ip: "Admin", userAgent });

    return { token: session.token };
}

module.exports.destroySession = async (accountId, sessionId) => {
    const session = await Session.findOne({ where: { accountId, id: sessionId } });

    if (session === null)
        return { code: 206, message: "The provided session does not exist" };

    await Session.destroy({ where: { accountId, id: sessionId } });
    stateBroadcaster.forceLogoutSession(sessionId);

    return { message: "The session has been successfully destroyed" };
};