const net = require("net");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const logger = require("../utils/logger");

module.exports = async (ws, context) => {
    const { entry, auditLogId } = context;
    const connectionStartTime = Date.now();

    const socket = new net.Socket();
    let connectionEstablished = false;

    socket.connect(entry.config.port || 23, entry.config.ip, () => {
        connectionEstablished = true;
        logger.info(`Telnet connection established`, { ip: entry.config.ip, port: entry.config.port || 23, entryId: entry.id });
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
    });

    socket.on("error", async (error) => {
        logger.error(`Telnet connection error`, { error: error.message, ip: entry.config.ip, port: entry.config.port || 23 });
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        if (ws.readyState === ws.OPEN) {
            ws.close(1011, error.message);
        }
    });

    ws.on("message", (data) => {
        try {
            data = data.toString();

            if (data.startsWith("\x01")) {
                const resizeData = data.substring(1);
                if (resizeData.includes(",")) {
                    const [width, height] = resizeData.split(",").map(Number);
                    if (!isNaN(width) && !isNaN(height)) {
                        const buffer = Buffer.from([
                            255, 250, 31, // IAC SB NAWS
                            (width >> 8) & 0xFF, width & 0xFF,
                            (height >> 8) & 0xFF, height & 0xFF,
                            255, 240 // IAC SE
                        ]);
                        socket.write(buffer);
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

    ws.on("close", async () => {
        await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        if (socket && !socket.destroyed) {
            socket.destroy();
        }
    });
};
