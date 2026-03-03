const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");

const handleShared = (ws, { serverSession }) => {
    const sessionId = serverSession.sessionId;
    const { lxcSocket } = SessionManager.getConnection(sessionId) || {};
    if (!lxcSocket || lxcSocket.readyState !== lxcSocket.OPEN) return ws.close(4014, "Session not connected");

    const logs = SessionManager.getLogBuffer(sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    SessionManager.addWebSocket(sessionId, ws, true);
    if (serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);

    const onMsg = (m) => { m = m instanceof Buffer ? m.toString() : m; if (m !== "OK" && ws.readyState === ws.OPEN) ws.send(m); };
    const onClose = () => ws.readyState === ws.OPEN && ws.close(4014, "Session ended");
    const onErr = () => ws.readyState === ws.OPEN && ws.close(4014, "Session error");

    lxcSocket.on("message", onMsg);
    lxcSocket.on("close", onClose);
    lxcSocket.on("error", onErr);

    ws.on("message", (data) => {
        if (!SessionManager.get(sessionId)?.shareWritable || lxcSocket.readyState !== lxcSocket.OPEN) return;
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h) && SessionManager.isActiveWs(sessionId, ws)) lxcSocket.send(`1:${w}:${h}:`);
            return;
        }
        SessionManager.setActiveWs(sessionId, ws);
        lxcSocket.send(`0:${data.length}:${data}`);
    });

    ws.on("close", () => {
        lxcSocket.removeListener("message", onMsg);
        lxcSocket.removeListener("close", onClose);
        lxcSocket.removeListener("error", onErr);
        SessionManager.removeWebSocket(sessionId, ws, true);
    });
};

const setupHandler = (ws, lxcSocket, sessionId) => {
    ws.on("message", (data) => {
        if (lxcSocket.readyState !== lxcSocket.OPEN) return;
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h) && (!sessionId || SessionManager.isActiveWs(sessionId, ws))) {
                lxcSocket.send(`1:${w}:${h}:`);
                if (sessionId) SessionManager.recordResize(sessionId, w, h);
            }
            return;
        }
        if (sessionId) SessionManager.setActiveWs(sessionId, ws);
        lxcSocket.send(`0:${data.length}:${data}`);
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) return handleShared(ws, context);

    const { serverSession } = context;
    if (!serverSession) return ws.close(4007, "Session required");

    const conn = SessionManager.getConnection(serverSession.sessionId);
    if (!conn?.lxcSocket) return ws.close(4014, "Session not connected");

    const { lxcSocket, auditLogId } = conn;
    const startTime = Date.now();

    const logs = SessionManager.getLogBuffer(serverSession.sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    SessionManager.addWebSocket(serverSession.sessionId, ws);
    SessionManager.setActiveWs(serverSession.sessionId, ws);
    setupHandler(ws, lxcSocket, serverSession.sessionId);

    const onMsg = (m) => { m = m instanceof Buffer ? m.toString() : m; if (m !== "OK" && ws.readyState === ws.OPEN) ws.send(m); };
    lxcSocket.on("message", onMsg);

    const onFirstResize = (data) => {
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h)) {
                lxcSocket.send(`1:${w}:${h - 1}:`);
                setTimeout(() => lxcSocket.send(`1:${w}:${h}:`), 50);
                ws.removeListener("message", onFirstResize);
            }
        }
    };
    ws.on("message", onFirstResize);

    ws.on("close", async () => {
        lxcSocket.removeListener("message", onMsg);
        ws.removeListener("message", onFirstResize);
        SessionManager.removeWebSocket(serverSession.sessionId, ws);
        await updateAuditLogWithSessionDuration(auditLogId, startTime);
    });
};
