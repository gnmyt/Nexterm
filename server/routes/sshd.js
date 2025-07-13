const prepareSSH = require("../utils/sshPreCheck");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");

module.exports = async (ws, req) => {
    const ssh = await prepareSSH(ws, req);
    if (!ssh) return;

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
                await updateAuditLogWithSessionDuration(ssh.auditLogId, ssh.connectionStartTime);
                stream.end();
                ssh.end();
            });
        });
    });
};
