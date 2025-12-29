const Session = require("../models/Session");
const Account = require("../models/Account");
const stateBroadcaster = require("../lib/StateBroadcaster");

module.exports = async (ws, req) => {
    const { sessionToken, tabId, browserId } = req.query;
    if (!sessionToken) return ws.close(4001, "Missing sessionToken");

    const session = await Session.findOne({ where: { token: sessionToken } });
    if (!session) return ws.close(4003, "Invalid session");

    await Session.update({ lastActivity: new Date() }, { where: { id: session.id } });

    const user = await Account.findByPk(session.accountId);
    if (!user) return ws.close(4004, "Account not found");

    const conn = { ws, tabId: tabId || null, browserId: browserId || null, sessionId: session.id };
    stateBroadcaster.register(user.id, session.id, ws, tabId || null, browserId || null);
    stateBroadcaster.sendAllStateToConnection(user.id, conn).catch(() => {});

    ws.on("message", async (msg) => {
        try {
            const { action, type } = JSON.parse(msg);
            if (action === "refresh") {
                type ? stateBroadcaster.sendStateToConnection(user.id, conn, type) : stateBroadcaster.sendAllStateToConnection(user.id, conn);
            }
        } catch {}
    });

    ws.on("close", () => stateBroadcaster.unregister(user.id, ws));
    ws.on("error", () => stateBroadcaster.unregister(user.id, ws));
};
