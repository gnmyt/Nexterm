const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage } = require("../utils/sshEventHandlers");
const { translateKeys } = require("../utils/keyTranslation");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");

const bindHandlers = (ws, conn, sessionId, config, isShared) => {
    const { dataSocket } = conn;

    const msgHandler = (data) => {
        if (isShared && !SessionManager.get(sessionId)?.shareWritable) return;
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
        dataSocket.write(translateKeys(data, config));
    };
    ws.on("message", msgHandler);

    const dataHandler = (data) => ws.readyState === ws.OPEN && ws.send(data.toString());
    dataSocket.on("data", dataHandler);

    return { msgHandler, dataHandler };
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

    SessionManager.addWebSocket(sessionId, ws, isShared);
    if (!isShared || serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);

    const { msgHandler, dataHandler } = bindHandlers(ws, conn, sessionId, entry?.config, isShared);

    ws.on("close", async () => {
        conn.dataSocket.removeListener("data", dataHandler);
        ws.removeListener("message", msgHandler);
        SessionManager.removeWebSocket(sessionId, ws, isShared);
        if (!isShared) await updateAuditLogWithSessionDuration(conn.auditLogId, startTime);
    });
};
