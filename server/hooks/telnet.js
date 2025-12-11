const net = require("net");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const logger = require("../utils/logger");

const createResizeBuffer = (width, height) => {
    return Buffer.from([
        255, 250, 31, // IAC SB NAWS
        (width >> 8) & 0xFF, width & 0xFF,
        (height >> 8) & 0xFF, height & 0xFF,
        255, 240 // IAC SE
    ]);
};

const setupSocketMessageHandler = (ws, socket) => {
    ws.on("message", (data) => {
        try {
            data = data.toString();

            if (data.startsWith("\x01")) {
                const resizeData = data.substring(1);
                if (resizeData.includes(",")) {
                    const [width, height] = resizeData.split(",").map(Number);
                    if (!isNaN(width) && !isNaN(height)) {
                        socket.write(createResizeBuffer(width, height));
                        return;
                    }
                }
                if (resizeData) {
                    socket.write(resizeData);
                }
            } else {
                socket.write(data);
            }
        } catch (error) {
            logger.error(`Error sending message to telnet`, { error: error.message });
        }
    });
};

module.exports = async (ws, context) => {
    const { entry, auditLogId, serverSession } = context;
    const connectionStartTime = Date.now();

    let existingConnection = null;
    if (serverSession) existingConnection = SessionManager.getConnection(serverSession.sessionId);

    if (existingConnection) {
        const socket = existingConnection.socket;

        const onData = (data) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(data.toString());
            }
        };
        socket.on("data", onData);

        SessionManager.addWebSocket(serverSession.sessionId, ws);
        setupSocketMessageHandler(ws, socket);

        ws.on("close", () => {
            socket.removeListener("data", onData);
            SessionManager.removeWebSocket(serverSession.sessionId, ws);
        });

        return;
    }

    const socket = new net.Socket();
    let connectionEstablished = false;

    socket.connect(entry.config.port || 23, entry.config.ip, () => {
        connectionEstablished = true;
        logger.info(`Telnet connection established`, { ip: entry.config.ip, port: entry.config.port || 23, entryId: entry.id });

        if (serverSession) {
            SessionManager.setConnection(serverSession.sessionId, { socket, auditLogId });
            SessionManager.addWebSocket(serverSession.sessionId, ws);
        }
    });

    socket.on("data", (data) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data.toString());
        }
    });

    socket.on("close", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        if (ws.readyState === ws.OPEN) {
            ws.close();
        }
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });

    socket.on("error", async (error) => {
        logger.error(`Telnet connection error`, { error: error.message, ip: entry.config.ip, port: entry.config.port || 23 });
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        if (ws.readyState === ws.OPEN) {
            ws.close(1011, error.message);
        }
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });

    setupSocketMessageHandler(ws, socket);

    ws.on("close", async () => {
        if (serverSession) SessionManager.removeWebSocket(serverSession.sessionId, ws);
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
    });
};
