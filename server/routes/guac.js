const wsAuth = require("../middlewares/wsAuth");
const guacamoleHook = require("../hooks/guacamole");
const SessionManager = require("../lib/SessionManager");
const { safeCloseWs } = require("../utils/wsClose");
const { TRUST_CLOSE_CODE, TRUST_CLOSE_REASON } = require("../utils/hostTrust");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;
    if (context.isShared) return guacamoleHook(ws, context);

    const { serverSession } = context;
    if (!serverSession) return ws.close(4007, "Session required");

    SessionManager.resume(serverSession.sessionId, null, null, context.session?.id || null);
    const session = SessionManager.get(serverSession.sessionId);
    if (!session) {
        const failedReason = SessionManager.consumeFailedReason(serverSession.sessionId);
        if (failedReason) return safeCloseWs(ws, 4017, failedReason);
        return ws.close(4007, "Session not found");
    }
    if (session.trustChallenge) return ws.close(TRUST_CLOSE_CODE, TRUST_CLOSE_REASON);
    if (!session.guacReady) {
        try {
            await SessionManager.waitForGuacReady(serverSession.sessionId);
        } catch {
            if (SessionManager.get(serverSession.sessionId)?.trustChallenge)
                return ws.close(TRUST_CLOSE_CODE, TRUST_CLOSE_REASON);
            const failedReason = SessionManager.consumeFailedReason(serverSession.sessionId);
            if (failedReason) return safeCloseWs(ws, 4017, failedReason);
            return ws.close(4014, "Guacamole not prepared");
        }
    }

    const monitor = Number.parseInt(req.query?.monitor, 10);
    const pinnedMonitor = Number.isInteger(monitor) && monitor >= 0 ? monitor : null;

    await guacamoleHook(ws, { ...context, pinnedMonitor });
};
