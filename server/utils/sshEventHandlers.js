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

/**
 * Triggers a passive SSH session by sending a newline character.
 * * Inspired by Netmiko's session establishment. Passive proxies (OCI)
 * and legacy devices (Cisco/HP) often remain silent until they receive input.
 * This function acts as a behavioral trigger to ensure the data stream begins,
 * followed by an ANSI escape sequence to clear the terminal. Since the reset
 * uses ANSI codes, it is handled by the terminal emulator (xterm.js), not the
 * remote shell, so it works even if the device doesn't have a clear command,
 * ensuring compatibility without relying on shell-specific commands.
 * * Note: Most Linux servers send their banner/MOTD in < 50ms; they will never
 * trigger this function as the data listener clears this timer immediately.
 * * @param {Object} stream - The SSH2 channel stream.
 * @param {number} [timeoutMs=300] - Wait time before triggering.
 * @returns {NodeJS.Timeout} - The timer instance for external cleanup.
 */
function triggerPassiveSession(stream, timeoutMs = 300) {
    const triggerTimer = setTimeout(() => {
        if (stream.writable) {
            stream.write('\x0A\x1B[2J\x1B[H');
        }
    }, timeoutMs);

    const cleanup = () => clearTimeout(triggerTimer);

    // Self-destruct logic: the timer dies if data arrives,
    // an error occurs, or the stream closes.
    stream.once("data", cleanup);
    stream.once("error", cleanup);
    stream.once("close", cleanup);
}

module.exports = { parseResizeMessage, setupSSHEventHandlers, triggerPassiveSession };
