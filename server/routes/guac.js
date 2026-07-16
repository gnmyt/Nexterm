const wsAuth = require("../middlewares/wsAuth");
const guacamoleHook = require("../hooks/guacamole");
const SessionManager = require("../lib/SessionManager");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;
    if (context.isShared) return guacamoleHook(ws, context);

    const { serverSession } = context;
    if (!serverSession) return ws.close(4007, "Session required");

    SessionManager.resume(serverSession.sessionId);
    const session = SessionManager.get(serverSession.sessionId);
    if (!session) {
        const failedReason = SessionManager.consumeFailedReason(serverSession.sessionId);
        if (failedReason) return ws.close(4017, failedReason);
        return ws.close(4007, "Session not found");
    }
    if (!session.guacReady) {
        try {
            await SessionManager.waitForGuacReady(serverSession.sessionId);
        } catch {
            const failedReason = SessionManager.consumeFailedReason(serverSession.sessionId);
            if (failedReason) return ws.close(4017, failedReason);
            return ws.close(4014, "Guacamole not prepared");
        }
    }

    const monitor = Number.parseInt(req.query?.monitor, 10);
    const pinnedMonitor = Number.isInteger(monitor) && monitor >= 0 ? monitor : null;

    await guacamoleHook(ws, { connectionConfig: { serverSession }, pinnedMonitor });
};
