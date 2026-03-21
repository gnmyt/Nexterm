const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");

const handleShared = (ws, { serverSession }) => {
    const sessionId = serverSession.sessionId;
    const { dataSocket } = SessionManager.getConnection(sessionId) || {};
    if (!dataSocket || dataSocket.destroyed) return ws.close(4014, "Session not connected");

    const logs = SessionManager.getLogBuffer(sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    SessionManager.addWebSocket(sessionId, ws, true);
    if (serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);

    const onData = (data) => { const text = data.toString(); if (text !== "OK" && ws.readyState === ws.OPEN) ws.send(text); };
    const onClose = () => ws.readyState === ws.OPEN && ws.close(4014, "Session ended");
    const onErr = () => ws.readyState === ws.OPEN && ws.close(4014, "Session error");

    dataSocket.on("data", onData);
    dataSocket.on("close", onClose);
    dataSocket.on("error", onErr);

    ws.on("message", (data) => {
        if (!SessionManager.get(sessionId)?.shareWritable || dataSocket.destroyed) return;
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h) && SessionManager.isActiveWs(sessionId, ws)) dataSocket.write(`1:${w}:${h}:`);
            return;
        }
        SessionManager.setActiveWs(sessionId, ws);
        dataSocket.write(`0:${data.length}:${data}`);
    });

    ws.on("close", () => {
        dataSocket.removeListener("data", onData);
        dataSocket.removeListener("close", onClose);
        dataSocket.removeListener("error", onErr);
        SessionManager.removeWebSocket(sessionId, ws, true);
    });
};

const setupHandler = (ws, dataSocket, sessionId) => {
    ws.on("message", (data) => {
        if (dataSocket.destroyed) return;
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h) && (!sessionId || SessionManager.isActiveWs(sessionId, ws))) {
                dataSocket.write(`1:${w}:${h}:`);
                if (sessionId) SessionManager.recordResize(sessionId, w, h);
            }
            return;
        }
        if (sessionId) SessionManager.setActiveWs(sessionId, ws);
        dataSocket.write(`0:${data.length}:${data}`);
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) return handleShared(ws, context);

    const { serverSession } = context;
    if (!serverSession) return ws.close(4007, "Session required");

    const conn = SessionManager.getConnection(serverSession.sessionId);
    if (!conn?.dataSocket) return ws.close(4014, "Session not connected");

    const { dataSocket, auditLogId } = conn;
    const startTime = Date.now();

    const logs = SessionManager.getLogBuffer(serverSession.sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    SessionManager.addWebSocket(serverSession.sessionId, ws);
    SessionManager.setActiveWs(serverSession.sessionId, ws);
    setupHandler(ws, dataSocket, serverSession.sessionId);

    const onData = (data) => { const text = data.toString(); if (text !== "OK" && ws.readyState === ws.OPEN) ws.send(text); };
    dataSocket.on("data", onData);

    const onFirstResize = (data) => {
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h)) {
                dataSocket.write(`1:${w}:${h - 1}:`);
                setTimeout(() => dataSocket.write(`1:${w}:${h}:`), 50);
                ws.removeListener("message", onFirstResize);
            }
        }
    };
    ws.on("message", onFirstResize);

    ws.on("close", async () => {
        dataSocket.removeListener("data", onData);
        ws.removeListener("message", onFirstResize);
        SessionManager.removeWebSocket(serverSession.sessionId, ws);
        await updateAuditLogWithSessionDuration(auditLogId, startTime);
    });
};
