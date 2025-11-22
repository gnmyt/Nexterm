const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");

const setupStreamHandlers = (ws, stream) => {
    const onData = (data) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data.toString());
        }
    };
    stream.on("data", onData);

    ws.on("message", (data) => {
        if (data.startsWith("\x01")) {
            const resizeData = data.substring(1);
            if (resizeData.includes(",")) {
                const [width, height] = resizeData.split(",").map(Number);
                if (!isNaN(width) && !isNaN(height)) {
                    stream.setWindow(height, width);
                    return;
                }
            }
            stream.write(data);
        } else {
            stream.write(data);
        }
    });

    return onData;
};

module.exports = async (ws, context) => {
    const { auditLogId, serverSession } = context;
    let { ssh } = context;
    const connectionStartTime = Date.now();

    let existingConnection = null;
    if (serverSession) existingConnection = SessionManager.getConnection(serverSession.sessionId);

    if (existingConnection) {
        ssh = existingConnection.ssh;
        const stream = existingConnection.stream;

        const onData = setupStreamHandlers(ws, stream);

        ws.on("close", () => {
            stream.removeListener("data", onData);
        });

        return;
    }

    ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color" }, (err, stream) => {
            if (err) {
                ws.close(4008, `Shell error: ${err.message}`);
                return;
            }

            if (serverSession) {
                SessionManager.setConnection(serverSession.sessionId, { ssh, stream, auditLogId });
            }

            const onData = setupStreamHandlers(ws, stream);

            ws.on("close", async () => {
                stream.removeListener("data", onData);
                await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            });

            stream.on("close", () => {
                ws.close();
                if (serverSession) SessionManager.remove(serverSession.sessionId);
            });
        });
    });

    ssh.on("error", (error) => {
        const errorMsg = error.level === "client-timeout" ? "Client Timeout reached" : `SSH Error: ${error.message}`;
        ws.close(error.level === "client-timeout" ? 4007 : 4005, errorMsg);
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });

    ssh.on("end", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        ws.close(4006, "Connection closed");
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });

    ssh.on("exit", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        ws.close(4006, "Connection exited");
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });

    ssh.on("close", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
        ws.close(4007, "Connection closed");
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });
};
