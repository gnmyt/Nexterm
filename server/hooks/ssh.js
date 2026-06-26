const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage } = require("../utils/sshEventHandlers");
const { translateKeys } = require("../utils/keyTranslation");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { SCRIPT_MAGIC } = require("../lib/ScriptLayer");

const bindHandlers = (ws, conn, sessionId, config, isShared) => {
    const { dataSocket, scriptLayer } = conn;
    let termCols = 80;
    let termRows = 24;

    const msgHandler = (data) => {
        if (isShared && !SessionManager.get(sessionId)?.shareWritable) return;
        const msg = data.toString();

        if (scriptLayer && msg.startsWith(SCRIPT_MAGIC)) return;

        const resize = parseResizeMessage(msg);
        if (resize) {
            if (SessionManager.isActiveWs(sessionId, ws)) {
                controlPlane.sendSessionResize(conn.sessionId, resize.width, resize.height);
                SessionManager.recordResize(sessionId, resize.width, resize.height);
            }
            termCols = resize.width;
            termRows = resize.height;
            return;
        }
        SessionManager.setActiveWs(sessionId, ws);
        dataSocket.write(translateKeys(data, config));
    };
    ws.on("message", msgHandler);

    const dataHandler = (data) => {
        if (scriptLayer?.suppressOutput) return;
        let str = data.toString();

        // PSReadLine sends \033[6n (DSR) to query the cursor position. Over WebSocket
        // the round-trip delay causes the CPR response to arrive after PSReadLine has
        // already timed out waiting for it. PSReadLine then treats the late \033[row;colR
        // as an unknown key sequence, consuming the \033[ prefix and echoing the remainder
        // ("56;13R") as literal text into the terminal. Intercept the query here and reply
        // immediately so the response reaches PSReadLine before its timeout expires.
        if (str.includes('\x1b[6n')) {
            str = str.replaceAll('\x1b[6n', '');
            dataSocket.write(`\x1b[${termRows};${termCols}R`);
        }

        if (str && ws.readyState === ws.OPEN) ws.send(str);
    };
    dataSocket.on("data", dataHandler);

    return { msgHandler, dataHandler };
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

    SessionManager.addWebSocket(sessionId, ws, isShared);
    if (!isShared || serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);

    const { msgHandler, dataHandler } = bindHandlers(ws, conn, sessionId, entry?.config, isShared);

    if (conn.scriptLayer) {
        conn.scriptLayer.createMessageHandler(ws);
    }

    if (!isShared) {
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
        conn.dataSocket.removeListener("data", dataHandler);
        ws.removeListener("message", msgHandler);
        if (conn.scriptLayer) conn.scriptLayer.removeMessageHandler(ws);
        SessionManager.removeWebSocket(sessionId, ws, isShared);
        if (!isShared) await updateAuditLogWithSessionDuration(conn.auditLogId, startTime);
    });
};

module.exports = async (ws, ctx) => handleSession(ws, ctx, !!ctx.isShared);
