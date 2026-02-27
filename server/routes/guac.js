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
    if (!session) return ws.close(4007, "Session not found");
    if (!session.guacReady) return ws.close(4014, "Guacamole not prepared");

    await guacamoleHook(ws, { connectionConfig: { serverSession } });
};
