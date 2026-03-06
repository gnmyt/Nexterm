const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const logger = require("./logger");

const parseResizeMessage = (message) => {
    if (!message.startsWith?.("\x01")) return null;

    const resizeData = message.substring(1);
    if (!resizeData.includes(",")) return null;

    const [width, height] = resizeData.split(",").map(Number);
    if (isNaN(width) || isNaN(height)) return null;

    return { width, height };
};

const setupSSHEventHandlers = (ssh, ws, options) => {
    const { auditLogId, serverSession, connectionStartTime, rejectConnecting } = options;

    ssh.on("error", (error) => {
        logger.error(`SSH error`, { message: error.message, level: error.level });
        const errorMsg = error.level === "client-timeout"
            ? "Client Timeout reached"
            : `SSH Error: ${error.message}`;
        rejectConnecting?.(error);
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
        if (ssh._jumpConnections) {
            ssh._jumpConnections.forEach(conn => conn.ssh.end());
        }
        ws.close(4007, "Connection closed");
        if (serverSession) SessionManager.remove(serverSession.sessionId);
    });
};

module.exports = { parseResizeMessage, setupSSHEventHandlers };