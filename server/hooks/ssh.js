const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage, setupSSHEventHandlers } = require("../utils/sshEventHandlers");
const { translateKeys } = require("../utils/keyTranslation");

const setupStreamHandlers = (ws, stream, sessionId = null, config = null) => {
    const onData = (data) => ws.readyState === ws.OPEN && ws.send(data.toString());
    stream.on("data", onData);
    ws.on("message", (data) => {
        const resize = parseResizeMessage(data);
        if (resize) {
            if (!sessionId || SessionManager.isActiveWs(sessionId, ws)) {
                stream.setWindow(resize.height, resize.width);
                if (sessionId) SessionManager.recordResize(sessionId, resize.width, resize.height);
            }
        } else {
            if (sessionId) SessionManager.setActiveWs(sessionId, ws);
            const translatedData = translateKeys(data, config);
            stream.write(translatedData);
        }
    });
    return onData;
};

const handleSharedConnection = (ws, context) => {
    const { serverSession, entry } = context;
    const sessionId = serverSession.sessionId;
    const connection = SessionManager.getConnection(sessionId);
    if (!connection?.stream) {
        ws.close(4014, "Session not connected");
        return;
    }
    
    const { stream } = connection;
    const config = entry?.config || null;
    const bufferedLogs = SessionManager.getLogBuffer(sessionId);
    if (bufferedLogs && ws.readyState === ws.OPEN) ws.send(bufferedLogs);
    
    SessionManager.addWebSocket(sessionId, ws, true);
    if (serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);
    
    const onData = (data) => ws.readyState === ws.OPEN && ws.send(data.toString());
    stream.on("data", onData);
    
    ws.on("message", (data) => {
        const session = SessionManager.get(sessionId);
        if (!session?.shareWritable) return;
        
        const resize = parseResizeMessage(data);
        if (resize) {
            if (SessionManager.isActiveWs(sessionId, ws)) {
                stream.setWindow(resize.height, resize.width);
                SessionManager.recordResize(sessionId, resize.width, resize.height);
            }
        } else {
            SessionManager.setActiveWs(sessionId, ws);
            const translatedData = translateKeys(data, config);
            stream.write(translatedData);
        }
    });
    
    ws.on("close", () => {
        stream.removeListener("data", onData);
        SessionManager.removeWebSocket(sessionId, ws, true);
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) return handleSharedConnection(ws, context);

    const { auditLogId, serverSession, ssh, reuseConnection, entry, organizationId } = context;
    const config = entry?.config || null;
    const connectionStartTime = Date.now();

    if (reuseConnection) {
        const { stream } = SessionManager.getConnection(serverSession.sessionId);
        const bufferedLogs = SessionManager.getLogBuffer(serverSession.sessionId);
        if (bufferedLogs && ws.readyState === ws.OPEN) ws.send(bufferedLogs);
        
        SessionManager.addWebSocket(serverSession.sessionId, ws);
        SessionManager.setActiveWs(serverSession.sessionId, ws);
        const onData = setupStreamHandlers(ws, stream, serverSession.sessionId, config);
        const onFirstResize = (data) => {
            const resize = parseResizeMessage(data);
            if (resize) {
                stream.setWindow(resize.height - 1, resize.width);
                setTimeout(() => stream.setWindow(resize.height, resize.width), 50);
                SessionManager.recordResize(serverSession.sessionId, resize.width, resize.height);
                ws.removeListener("message", onFirstResize);
            }
        };
        ws.on("message", onFirstResize);
        ws.on("close", () => {
            stream.removeListener("data", onData);
            ws.removeListener("message", onFirstResize);
            SessionManager.removeWebSocket(serverSession.sessionId, ws);
        });
        return;
    }

    let resolve, reject;
    if (serverSession) {
        SessionManager.setConnectingPromise(serverSession.sessionId, new Promise((res, rej) => { resolve = res; reject = rej; }));
    }

    ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color" }, async (err, stream) => {
            if (err) {
                reject?.(err);
                return ws.close(4008, `Shell error: ${err.message}`);
            }

            if (serverSession) {
                await SessionManager.initRecording(serverSession.sessionId, organizationId);
                stream.on("data", (data) => SessionManager.appendLog(serverSession.sessionId, data.toString()));
                SessionManager.setConnection(serverSession.sessionId, { ssh, stream, auditLogId });
                SessionManager.addWebSocket(serverSession.sessionId, ws);
                SessionManager.setActiveWs(serverSession.sessionId, ws);
                resolve?.();
            }
            const onData = setupStreamHandlers(ws, stream, serverSession?.sessionId, config);
            ws.on("close", async () => {
                stream.removeListener("data", onData);
                if (serverSession) SessionManager.removeWebSocket(serverSession.sessionId, ws);
                await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            });
            stream.on("close", async () => {
                ws.close();
                if (serverSession) await SessionManager.remove(serverSession.sessionId);
            });
        });
    });

    setupSSHEventHandlers(ssh, ws, { auditLogId, serverSession, connectionStartTime });
};
