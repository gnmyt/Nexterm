const wsAuth = require("../middlewares/wsAuth");
const sshHook = require("../hooks/ssh");
const pveLxcHook = require("../hooks/pve-lxc");
const telnetHook = require("../hooks/telnet");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");

const waitForConnection = async (sessionId, timeoutMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const session = SessionManager.get(sessionId);
        if (!session) return { conn: null, sessionRemoved: true };
        const conn = SessionManager.getConnection(sessionId);
        if (conn) return { conn, sessionRemoved: false };
        await new Promise(r => setTimeout(r, 100));
    }
    return { conn: null, sessionRemoved: false };
};

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, serverSession } = context;
    const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;

    if (context.isShared) {
        if (protocol === "ssh") return sshHook(ws, context);
        if (protocol === "pve-lxc" || protocol === "pve-shell") return pveLxcHook(ws, context);
        return ws.close(4015, "Sharing not supported");
    }

    if (!serverSession) return ws.close(4007, "Session required");

    SessionManager.resume(serverSession.sessionId);
    const { conn, sessionRemoved } = await waitForConnection(serverSession.sessionId, 5000);
    
    if (!conn) {
        if (!sessionRemoved) {
            logger.warn("Connection timeout, removing session", { sessionId: serverSession.sessionId });
            await SessionManager.remove(serverSession.sessionId);
        }
        return ws.close(4014, "Connection not available");
    }

    try {
        if (protocol === "ssh") await sshHook(ws, { ...context, reuseConnection: true, ssh: conn.ssh });
        else if (protocol === "telnet") await telnetHook(ws, { ...context, reuseConnection: true });
        else if (protocol === "pve-lxc" || protocol === "pve-shell") await pveLxcHook(ws, { ...context, reuseConnection: true });
        else ws.close(4009, `Unsupported: ${entry.type}`);
    } catch (err) {
        logger.error("Terminal error", { error: err.message, sessionId: serverSession.sessionId });
        ws.close(4005, err.message);
    }
};
