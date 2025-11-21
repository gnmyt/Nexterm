const { updateAuditLogWithSessionDuration } = require("../controllers/audit");

module.exports = async (ws, context) => {
    const { ssh, auditLogId } = context;
    const connectionStartTime = Date.now();

    ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color" }, (err, stream) => {
            if (err) {
                ws.close(4008, `Shell error: ${err.message}`);
                return;
            }

            stream.on("close", () => ws.close());
            stream.on("data", (data) => ws.send(data.toString()));

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

            ws.on("close", async () => {
                await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
                stream.end();
                ssh.end();
                if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
            });
        });
    });

    ssh.on("error", (error) => {
        const errorMsg = error.level === "client-timeout" ? "Client Timeout reached" : `SSH Error: ${error.message}`;
        ws.close(error.level === "client-timeout" ? 4007 : 4005, errorMsg);
    });

    ssh.on("end", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        ws.close(4006, "Connection closed");
    });

    ssh.on("exit", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        ws.close(4006, "Connection exited");
    });

    ssh.on("close", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
        ws.close(4007, "Connection closed");
    });
};
