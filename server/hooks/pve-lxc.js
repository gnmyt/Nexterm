const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { buildParticipant, createWriteGuard } = require("../utils/sessionParticipant");
const { createDecodedTextStream } = require("../utils/terminalStream");

const handleShared = (ws, ctx) => {
    const { serverSession } = ctx;
    const sessionId = serverSession.sessionId;
    const { dataSocket } = SessionManager.getConnection(sessionId) || {};
    if (!dataSocket || dataSocket.destroyed) return ws.close(4014, "Session not connected");

    const logs = SessionManager.getLogBuffer(sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    const canWrite = createWriteGuard(ctx, sessionId);

    SessionManager.addWebSocket(sessionId, ws, true, buildParticipant(ctx));
    if (canWrite()) SessionManager.setActiveWs(sessionId, ws);

    const outputStream = createDecodedTextStream((text) => {
        if (text !== "OK" && ws.readyState === ws.OPEN) ws.send(text);
    });
    const onData = (data) => {
        SessionManager.updateActivity(sessionId, { touchLoginSession: false });
        outputStream.write(data);
    };
    const onClose = () => {
        outputStream.end();
        ws.readyState === ws.OPEN && ws.close(4014, "Session ended");
    };
    const onErr = () => ws.readyState === ws.OPEN && ws.close(4014, "Session error");

    dataSocket.on("data", onData);
    dataSocket.on("close", onClose);
    dataSocket.on("error", onErr);

    ws.on("message", (data) => {
        if (!canWrite() || dataSocket.destroyed) return;
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h) && SessionManager.isActiveWs(sessionId, ws)) dataSocket.write(`1:${w}:${h}:`);
            return;
        }
        SessionManager.setActiveWs(sessionId, ws);
        SessionManager.markTyping(sessionId, ws);
        SessionManager.updateActivity(sessionId, { touchLoginSession: false });
        dataSocket.write(`0:${data.length}:${data}`);
    });

    ws.on("close", () => {
        outputStream.end();
        dataSocket.removeListener("data", onData);
        dataSocket.removeListener("close", onClose);
        dataSocket.removeListener("error", onErr);
        SessionManager.removeWebSocket(sessionId, ws, true);
    });
};

const setupHandler = (ws, dataSocket, sessionId, canWrite = () => true) => {
    const outputStream = createDecodedTextStream((text) => {
        if (text !== "OK" && ws.readyState === ws.OPEN) ws.send(text);
    });
    ws.on("message", (data) => {
        if (dataSocket.destroyed || !canWrite()) return;
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h) && (!sessionId || SessionManager.isActiveWs(sessionId, ws))) {
                dataSocket.write(`1:${w}:${h}:`);
                if (sessionId) SessionManager.recordResize(sessionId, w, h);
            }
            return;
        }
        if (sessionId) {
            SessionManager.setActiveWs(sessionId, ws);
            SessionManager.markTyping(sessionId, ws);
            SessionManager.updateActivity(sessionId);
        }
        dataSocket.write(`0:${data.length}:${data}`);
    });
    return outputStream;
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

    const canWrite = createWriteGuard(context, serverSession.sessionId);
    SessionManager.addWebSocket(serverSession.sessionId, ws, false, buildParticipant(context));
    if (canWrite()) SessionManager.setActiveWs(serverSession.sessionId, ws);
    const outputStream = setupHandler(ws, dataSocket, serverSession.sessionId, canWrite);

    const onData = (data) => {
        SessionManager.updateActivity(serverSession.sessionId);
        outputStream.write(data);
    };
    dataSocket.on("data", onData);

    const onFirstResize = (data) => {
        data = data.toString();
        if (canWrite() && data.startsWith("\x01")) {
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
        outputStream.end();
        dataSocket.removeListener("data", onData);
        ws.removeListener("message", onFirstResize);
        SessionManager.removeWebSocket(serverSession.sessionId, ws);
        await updateAuditLogWithSessionDuration(auditLogId, startTime);
    });
};
