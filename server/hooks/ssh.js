const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage } = require("../utils/sshEventHandlers");
const { translateKeys } = require("../utils/keyTranslation");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { SCRIPT_MAGIC } = require("../lib/ScriptLayer");
const { buildParticipant, createWriteGuard } = require("../utils/sessionParticipant");
const { createDecodedTextStream } = require("../utils/terminalStream");

const bindHandlers = (ws, conn, sessionId, config, isShared, canWrite) => {
    const { dataSocket, scriptLayer } = conn;

    const msgHandler = (data) => {
        if (!canWrite()) return;
        const msg = data.toString();

        if (scriptLayer && msg.startsWith(SCRIPT_MAGIC)) return;

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
        if (scriptLayer?.suppressOutput) return;
        SessionManager.updateActivity(sessionId, { touchLoginSession: !isShared });
        outputStream.write(data);
    };
    dataSocket.on("data", dataHandler);

    return { msgHandler, dataHandler, endData: () => outputStream.end() };
};

const handleSession = (ws, ctx, isShared) => {
    const { serverSession, entry } = ctx;
    const sessionId = serverSession.sessionId;
    const conn = SessionManager.getConnection(sessionId);

    if (!conn?.dataSocket) return ws.close(4014, "Session not connected");

    const startTime = Date.now();

    if (!conn.scriptLayer) {
        const logs = SessionManager.getLogBuffer(sessionId);
        if (logs && ws.readyState === ws.OPEN) ws.send(logs);
    }

    const canWrite = createWriteGuard(ctx, sessionId);

    SessionManager.addWebSocket(sessionId, ws, isShared, buildParticipant(ctx));
    if (canWrite()) SessionManager.setActiveWs(sessionId, ws);

    const { msgHandler, dataHandler, endData } = bindHandlers(ws, conn, sessionId, entry?.config, isShared, canWrite);

    if (conn.scriptLayer && (!isShared || canWrite())) {
        conn.scriptLayer.createMessageHandler(ws, canWrite);
    }

    if (!isShared && canWrite()) {
        const onResize = (data) => {
            const r = parseResizeMessage(data);
            if (r) {
                controlPlane.sendSessionResize(conn.sessionId, r.width, r.height);
                ws.removeListener("message", onResize);
            }
        };
        ws.on("message", onResize);
        ws.on("close", () => ws.removeListener("message", onResize));
    }

    ws.on("close", async () => {
        endData();
        conn.dataSocket.removeListener("data", dataHandler);
        ws.removeListener("message", msgHandler);
        if (conn.scriptLayer) conn.scriptLayer.removeMessageHandler(ws);
        SessionManager.removeWebSocket(sessionId, ws, isShared);
        if (!isShared) await updateAuditLogWithSessionDuration(conn.auditLogId, startTime);
    });
};

module.exports = async (ws, ctx) => handleSession(ws, ctx, !!ctx.isShared);
