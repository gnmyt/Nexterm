const { WebSocket } = require("ws");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const logger = require("../utils/logger");

const handleResize = (data, socket, sendFn) => {
    if (data.startsWith("\x01")) {
        const resizeData = data.substring(1);
        if (resizeData.includes(",")) {
            const [width, height] = resizeData.split(",").map(Number);
            if (!isNaN(width) && !isNaN(height)) {
                sendFn(width, height);
                return true;
            }
        }
    }
    return false;
};

const setupClientMessageHandler = (ws, lxcSocket, vmid) => {
    ws.on("message", (data) => {
        try {
            data = data.toString();

            if (lxcSocket.readyState !== lxcSocket.OPEN) {
                logger.warn(`Attempted to send data to closed LXC socket`, { vmid });
                return;
            }

            const handled = handleResize(data, lxcSocket, (width, height) => {
                lxcSocket.send("1:" + width + ":" + height + ":");
            });

            if (!handled) {
                lxcSocket.send("0:" + data.length + ":" + data);
            }
        } catch (error) {
            logger.error(`Error sending message to LXC socket`, { error: error.message, vmid });
        }
    });
};

const setupLxcMessageHandler = (lxcSocket, ws, vmid) => {
    lxcSocket.on("message", (message) => {
        try {
            if (message instanceof Buffer) message = message.toString();

            if (message !== "OK" && ws.readyState === ws.OPEN) {
                ws.send(message);
            }
        } catch (error) {
            logger.error(`Error handling LXC socket message`, { error: error.message, vmid });
        }
    });
};

module.exports = async (ws, context) => {
    const { integration, entry, containerId, ticket, node, vncTicket, auditLogId, serverSession } = context;
    const connectionStartTime = Date.now();

    let existingConnection = null;
    if (serverSession) existingConnection = SessionManager.getConnection(serverSession.sessionId);

    if (existingConnection) {
        const lxcSocket = existingConnection.lxcSocket;

        SessionManager.addWebSocket(serverSession.sessionId, ws);
        setupClientMessageHandler(ws, lxcSocket, containerId);

        const onMessage = (message) => {
            try {
                if (message instanceof Buffer) message = message.toString();

                if (message !== "OK" && ws.readyState === ws.OPEN) {
                    ws.send(message);
                }
            } catch (error) {
                logger.error(`Error handling LXC socket message`, { error: error.message, vmid: containerId });
            }
        };

        lxcSocket.on("message", onMessage);

        ws.on("close", () => {
            lxcSocket.removeListener("message", onMessage);
            SessionManager.removeWebSocket(serverSession.sessionId, ws);
        });

        return;
    }

    let keepAliveTimer;

    try {
        const vmid = containerId ?? entry.config?.vmid ?? "0";
        const containerPart = vmid === 0 || vmid === "0" ? "" : `lxc/${vmid}`;
        const server = { ...integration.config, ...entry.config };

        const lxcSocket = new WebSocket(
            `wss://${server.ip}:${server.port}/api2/json/nodes/${node}/${containerPart}/vncwebsocket?port=${vncTicket.port}&vncticket=${encodeURIComponent(vncTicket.ticket)}`,
            undefined,
            {
                rejectUnauthorized: false,
                headers: {
                    "Cookie": `PVEAuthCookie=${ticket.ticket}`,
                },
            }
        );

        lxcSocket.on("close", async () => {
            await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (ws.readyState === ws.OPEN) {
                ws.close();
            }
            if (serverSession) SessionManager.remove(serverSession.sessionId);
        });

        lxcSocket.on("open", () => {
            try {
                lxcSocket.send(`${server.username}:${vncTicket.ticket}\n`);
                keepAliveTimer = setInterval(() => {
                    if (lxcSocket.readyState === lxcSocket.OPEN) {
                        lxcSocket.send("2");
                    }
                }, 30000);

                if (serverSession) {
                    SessionManager.setConnection(serverSession.sessionId, { lxcSocket, keepAliveTimer, auditLogId });
                    SessionManager.addWebSocket(serverSession.sessionId, ws);
                }
            } catch (error) {
                logger.error(`Error during LXC socket open`, { error: error.message, vmid });
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                lxcSocket.close();
                if (ws.readyState === ws.OPEN) {
                    ws.close(1011, "Internal server error");
                }
            }
        });

        lxcSocket.on("error", async (error) => {
            logger.error(`LXC socket error`, { error: error.message, vmid });
            await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (lxcSocket.readyState === lxcSocket.OPEN) {
                lxcSocket.close();
            }
            if (ws.readyState === ws.OPEN) {
                ws.close(1011, "Internal server error");
            }
            if (serverSession) SessionManager.remove(serverSession.sessionId);
        });

        ws.on("close", async () => {
            if (serverSession) SessionManager.removeWebSocket(serverSession.sessionId, ws);
            await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        });

        setupClientMessageHandler(ws, lxcSocket, vmid);
        setupLxcMessageHandler(lxcSocket, ws, vmid);
    } catch (error) {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        throw error;
    }
};
