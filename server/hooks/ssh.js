const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage, setupSSHEventHandlers } = require("../utils/sshEventHandlers");

const setupStreamHandlers = (ws, stream, sessionId = null) => {
    const onData = (data) => ws.readyState === ws.OPEN && ws.send(data.toString());
    stream.on("data", onData);
    ws.on("message", (data) => {
        const resize = parseResizeMessage(data);
        if (resize) {
            if (!sessionId || SessionManager.isActiveWs(sessionId, ws)) {
                stream.setWindow(resize.height, resize.width);
            }
        } else {
            if (sessionId) SessionManager.setActiveWs(sessionId, ws);
            stream.write(data);
        }
    });
    return onData;
};

const handleSharedConnection = (ws, context) => {
    const { serverSession } = context;
    const sessionId = serverSession.sessionId;
    const connection = SessionManager.getConnection(sessionId);
    if (!connection?.stream) {
        ws.close(4014, "Session not connected");
        return;
    }
    
    const { stream } = connection;
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
            }
        } else {
            SessionManager.setActiveWs(sessionId, ws);
            stream.write(data);
        }
    });
    
    ws.on("close", () => {
        stream.removeListener("data", onData);
        SessionManager.removeWebSocket(sessionId, ws, true);
    });
};

module.exports = async (ws, context) => {
    if (context.isShared) return handleSharedConnection(ws, context);

    const { auditLogId, serverSession, ssh, reuseConnection } = context;
    const connectionStartTime = Date.now();

    if (reuseConnection) {
        const { stream } = SessionManager.getConnection(serverSession.sessionId);
        const bufferedLogs = SessionManager.getLogBuffer(serverSession.sessionId);
        if (bufferedLogs && ws.readyState === ws.OPEN) ws.send(bufferedLogs);
        
        SessionManager.addWebSocket(serverSession.sessionId, ws);
        SessionManager.setActiveWs(serverSession.sessionId, ws);
        const onData = setupStreamHandlers(ws, stream, serverSession.sessionId);
        const onFirstResize = (data) => {
            const resize = parseResizeMessage(data);
            if (resize) {
                stream.setWindow(resize.height - 1, resize.width);
                setTimeout(() => stream.setWindow(resize.height, resize.width), 50);
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
        ssh.shell({ term: "xterm-256color" }, (err, stream) => {
            if (err) {
                reject?.(err);
                return ws.close(4008, `Shell error: ${err.message}`);
            }
            if (serverSession) {
                stream.on("data", (data) => SessionManager.appendLog(serverSession.sessionId, data.toString()));
                SessionManager.setConnection(serverSession.sessionId, { ssh, stream, auditLogId });
                SessionManager.addWebSocket(serverSession.sessionId, ws);
                SessionManager.setActiveWs(serverSession.sessionId, ws);
                resolve?.();
            }
            const onData = setupStreamHandlers(ws, stream, serverSession?.sessionId);
            ws.on("close", async () => {
                stream.removeListener("data", onData);
                if (serverSession) SessionManager.removeWebSocket(serverSession.sessionId, ws);
                await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            });
            stream.on("close", () => {
                ws.close();
                if (serverSession) SessionManager.remove(serverSession.sessionId);
            });
        });
    });

    setupSSHEventHandlers(ssh, ws, { auditLogId, serverSession, connectionStartTime });
};
