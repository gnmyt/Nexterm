const { updateAuditLogWithSessionDuration } = require("../controllers/audit");

module.exports = async (ws, context) => {
    const { ssh, auditLogId } = context;
    const connectionStartTime = Date.now();

    ssh.on("ready", () => {
        ssh.shell({ term: "xterm-256color" }, (err, stream) => {
            if (err) {
                ws.close(4008, err.message);
                return;
            }

            stream.on("close", () => ws.close());

            stream.on("data", (data) => ws.send(data.toString()));

            ws.on("message", (data) => {
                if (data.startsWith("\x01")) {
                    const [width, height] = data.substring(1).split(",").map(Number);
                    stream.setWindow(height, width);
                } else {
                    stream.write(data);
                }
            });

            ws.on("close", async () => {
                await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
                stream.end();
                ssh.end();
            });
        });
    });

    ssh.on("error", (error) => {
        if(error.level === "client-timeout") {
            ws.close(4007, "Client Timeout reached");
        } else {
            ws.close(4005, error.message);
        }
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
        ws.close(4007, "Connection closed");
    });
};
