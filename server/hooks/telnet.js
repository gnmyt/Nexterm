const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage } = require("../utils/sshEventHandlers");
const { translateKeys } = require("../utils/keyTranslation");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { buildParticipant, createWriteGuard } = require("../utils/sessionParticipant");
const { createDecodedTextStream } = require("../utils/terminalStream");

const bindHandlers = (ws, conn, sessionId, config, isShared, canWrite) => {
    const { dataSocket } = conn;

    const msgHandler = (data) => {
        if (!canWrite()) return;
        const msg = data.toString();
        const resize = parseResizeMessage(msg);
        if (resize) {
            if (SessionManager.isActiveWs(sessionId, ws)) {
                controlPlane.sendSessionResize(conn.sessionId, resize.width, resize.height);
                SessionManager.recordResize(sessionId, resize.width, resize.height);
            }
            return;
        }
        SessionManager.setActiveWs(sessionId, ws);
        SessionManager.markTyping(sessionId, ws);
        SessionManager.updateActivity(sessionId, { touchLoginSession: !isShared });
        dataSocket.write(translateKeys(data, config));
    };
    ws.on("message", msgHandler);

    const outputStream = createDecodedTextStream((text) => {
        ws.readyState === ws.OPEN && ws.send(text);
    });
    const dataHandler = (data) => {
        SessionManager.updateActivity(sessionId, { touchLoginSession: !isShared });
        outputStream.write(data);
    };
    dataSocket.on("data", dataHandler);

    return { msgHandler, dataHandler, endData: () => outputStream.end() };
};

module.exports = async (ws, ctx) => {
    const { serverSession, entry, isShared } = ctx;
    if (!serverSession) return ws.close(4007, "Session required");

    const sessionId = serverSession.sessionId;
    const conn = SessionManager.getConnection(sessionId);

    if (!conn?.dataSocket) return ws.close(4014, "Session not connected");

    const startTime = Date.now();

    const logs = SessionManager.getLogBuffer(sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    const canWrite = createWriteGuard(ctx, sessionId);

    SessionManager.addWebSocket(sessionId, ws, isShared, buildParticipant(ctx));
    if (canWrite()) SessionManager.setActiveWs(sessionId, ws);

    const { msgHandler, dataHandler, endData } = bindHandlers(ws, conn, sessionId, entry?.config, isShared, canWrite);

    ws.on("close", async () => {
        endData();
        conn.dataSocket.removeListener("data", dataHandler);
        ws.removeListener("message", msgHandler);
        SessionManager.removeWebSocket(sessionId, ws, isShared);
        if (!isShared) await updateAuditLogWithSessionDuration(conn.auditLogId, startTime);
    });
};
