const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage } = require("../utils/sshEventHandlers");
const { translateKeys } = require("../utils/keyTranslation");
const { SCRIPT_MAGIC } = require("../lib/ScriptLayer");

const setupHandlers = (ws, stream, sessionId, config, scriptLayer, isShared = false) => {
    if (scriptLayer) scriptLayer.createMessageHandler(ws);

    const msgHandler = (data) => {
        if (isShared && !SessionManager.get(sessionId)?.shareWritable) return;

        const msg = data.toString();
        const resize = parseResizeMessage(msg);
        if (resize) {
            if (!sessionId || SessionManager.isActiveWs(sessionId, ws)) {
                stream.setWindow(resize.height, resize.width);
                if (sessionId) SessionManager.recordResize(sessionId, resize.width, resize.height);
            }
            return;
        }
        if (scriptLayer && msg.startsWith(SCRIPT_MAGIC)) return;
        if (sessionId) SessionManager.setActiveWs(sessionId, ws);
        stream.write(translateKeys(data, config));
    };
    ws.on("message", msgHandler);

    const dataHandler = (data) => ws.readyState === ws.OPEN && ws.send(data.toString());
    stream.on("data", dataHandler);

    return { msgHandler, dataHandler };
};

const handleAttach = (ws, ctx) => {
    const { serverSession, entry } = ctx;
    const conn = SessionManager.getConnection(serverSession.sessionId);
    if (!conn?.stream) return ws.close(4014, "Session not connected");

    const { stream, scriptLayer, auditLogId } = conn;
    const startTime = Date.now();

    const logs = SessionManager.getLogBuffer(serverSession.sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    SessionManager.addWebSocket(serverSession.sessionId, ws);
    SessionManager.setActiveWs(serverSession.sessionId, ws);

    const { msgHandler, dataHandler } = setupHandlers(ws, stream, serverSession.sessionId, entry?.config, scriptLayer);

    const onResize = (data) => {
        const r = parseResizeMessage(data);
        if (r) {
            stream.setWindow(r.height - 1, r.width);
            setTimeout(() => stream.setWindow(r.height, r.width), 50);
            ws.removeListener("message", onResize);
        }
    };
    ws.on("message", onResize);

    ws.on("close", async () => {
        stream.removeListener("data", dataHandler);
        ws.removeListener("message", msgHandler);
        ws.removeListener("message", onResize);
        if (scriptLayer) scriptLayer.removeMessageHandler(ws);
        SessionManager.removeWebSocket(serverSession.sessionId, ws);
        await updateAuditLogWithSessionDuration(auditLogId, startTime);
    });
};

const handleShared = (ws, ctx) => {
    const { serverSession, entry } = ctx;
    const conn = SessionManager.getConnection(serverSession.sessionId);
    if (!conn?.stream) return ws.close(4014, "Session not connected");

    const { stream, scriptLayer } = conn;
    const logs = SessionManager.getLogBuffer(serverSession.sessionId);
    if (logs && ws.readyState === ws.OPEN) ws.send(logs);

    SessionManager.addWebSocket(serverSession.sessionId, ws, true);
    if (serverSession.shareWritable) SessionManager.setActiveWs(serverSession.sessionId, ws);

    const { msgHandler, dataHandler } = setupHandlers(ws, stream, serverSession.sessionId, entry?.config, scriptLayer, true);

    ws.on("close", () => {
        stream.removeListener("data", dataHandler);
        ws.removeListener("message", msgHandler);
        if (scriptLayer) scriptLayer.removeMessageHandler(ws);
        SessionManager.removeWebSocket(serverSession.sessionId, ws, true);
    });
};

module.exports = async (ws, ctx) => ctx.isShared ? handleShared(ws, ctx) : handleAttach(ws, ctx);
