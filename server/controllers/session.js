const Session = require("../models/Session");

module.exports.listSessions = async (accountId, currentSessionId) => {
    return (await Session.findAll({ where: { accountId } }))
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .map(session => ({ id: session.id, ip: session.ip, userAgent: session.userAgent, lastActivity: session.lastActivity,
            current: session.id === currentSessionId }));
}

module.exports.destroySession = async (accountId, sessionId) => {
    const session = await Session.findOne({ where: { accountId, id: sessionId } });

    if (session === null)
        return { code: 206, message: "The provided session does not exist" };

    await Session.destroy({ where: { accountId, id: sessionId } });

    return { message: "The session has been successfully destroyed" };
};