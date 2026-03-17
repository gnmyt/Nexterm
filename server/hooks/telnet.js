const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { translateKeys } = require("../utils/keyTranslation");

const createResizeBuffer = (w, h) => Buffer.from([255, 250, 31, (w >> 8) & 0xFF, w & 0xFF, (h >> 8) & 0xFF, h & 0xFF, 255, 240]);

const setupSocketHandler = (ws, socket, sessionId, config) => {
    ws.on("message", (data) => {
        data = data.toString();
        if (data.startsWith("\x01")) {
            const [w, h] = data.substring(1).split(",").map(Number);
            if (!isNaN(w) && !isNaN(h)) {
                socket.write(createResizeBuffer(w, h));
                if (sessionId) SessionManager.recordResize(sessionId, w, h);
                return;
            }
        }
        socket.write(translateKeys(data, config));
    });
};

module.exports = async (ws, { entry, serverSession }) => {
    if (!serverSession) return ws.close(4007, "Session required");

    const conn = SessionManager.getConnection(serverSession.sessionId);
    if (!conn?.socket) return ws.close(4014, "Session not connected");

    const { socket, auditLogId } = conn;
    const startTime = Date.now();

    const logs = SessionManager.getLogBuffer(serverSession.sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    const onData = (data) => ws.readyState === ws.OPEN && ws.send(data.toString());
    socket.on("data", onData);

    SessionManager.addWebSocket(serverSession.sessionId, ws);
    SessionManager.setActiveWs(serverSession.sessionId, ws);
    setupSocketHandler(ws, socket, serverSession.sessionId, entry.config);

    ws.on("close", async () => {
        socket.removeListener("data", onData);
        SessionManager.removeWebSocket(serverSession.sessionId, ws);
        await updateAuditLogWithSessionDuration(auditLogId, startTime);
    });
};
