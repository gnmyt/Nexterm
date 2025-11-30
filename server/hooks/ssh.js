const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { parseResizeMessage, setupSSHEventHandlers } = require("../utils/sshEventHandlers");

const setupStreamHandlers = (ws, stream) => {
    const onData = (data) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data.toString());
        }
    };
    stream.on("data", onData);

    ws.on("message", (data) => {
        const resize = parseResizeMessage(data);
        if (resize) {
            stream.setWindow(resize.height, resize.width);
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

    setupSSHEventHandlers(ssh, ws, { auditLogId, serverSession, connectionStartTime });
};
