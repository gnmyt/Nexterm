const { WebSocket } = require("ws");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const logger = require("../utils/logger");

const handleSharedConnection = (ws, context) => {
    const { serverSession } = context;
    const sessionId = serverSession.sessionId;
    const { lxcSocket } = SessionManager.getConnection(sessionId) || {};
    if (!lxcSocket || lxcSocket.readyState !== lxcSocket.OPEN) return ws.close(4014, "Session not connected");

    const bufferedLogs = SessionManager.getLogBuffer(sessionId);
    if (bufferedLogs && ws.readyState === ws.OPEN) ws.send(bufferedLogs);
    
    SessionManager.addWebSocket(sessionId, ws, true);
    if (serverSession.shareWritable) SessionManager.setActiveWs(sessionId, ws);
    
    const onMessage = (message) => {
        if (message instanceof Buffer) message = message.toString();
        if (message !== "OK" && ws.readyState === ws.OPEN) ws.send(message);
    };
    const onLxcClose = () => ws.readyState === ws.OPEN && ws.close(4014, "Session ended");
    const onLxcError = () => ws.readyState === ws.OPEN && ws.close(4014, "Session error");
    
    lxcSocket.on("message", onMessage);
    lxcSocket.on("close", onLxcClose);
    lxcSocket.on("error", onLxcError);
    
    ws.on("message", (data) => {
        if (!SessionManager.get(sessionId)?.shareWritable || lxcSocket.readyState !== lxcSocket.OPEN) return;
        data = data.toString();
        
        if (data.startsWith("\x01")) {
            const [width, height] = data.substring(1).split(",").map(Number);
            if (!isNaN(width) && !isNaN(height) && SessionManager.isActiveWs(sessionId, ws))
                lxcSocket.send("1:" + width + ":" + height + ":");
            return;
        }
        
        SessionManager.setActiveWs(sessionId, ws);
        lxcSocket.send("0:" + data.length + ":" + data);
    });
    
    ws.on("close", () => {
        lxcSocket.removeListener("message", onMessage);
        lxcSocket.removeListener("close", onLxcClose);
        lxcSocket.removeListener("error", onLxcError);
        SessionManager.removeWebSocket(sessionId, ws, true);
    });
};

const handleResize = (data, sessionId, ws, sendFn) => {
    if (data.startsWith("\x01")) {
        const resizeData = data.substring(1);
        if (resizeData.includes(",")) {
            const [width, height] = resizeData.split(",").map(Number);
            if (!isNaN(width) && !isNaN(height)) {
                if (!sessionId || SessionManager.isActiveWs(sessionId, ws)) {
                    sendFn(width, height);
                    if (sessionId) SessionManager.recordResize(sessionId, width, height);
                }
                return true;
            }
        }
    }
    return false;
};

const setupClientMessageHandler = (ws, lxcSocket, vmid, sessionId = null) => {
    ws.on("message", (data) => {
        try {
            data = data.toString();

            if (lxcSocket.readyState !== lxcSocket.OPEN) {
                logger.warn(`Attempted to send data to closed LXC socket`, { vmid });
                return;
            }

            const handled = handleResize(data, sessionId, ws, (width, height) => {
                lxcSocket.send("1:" + width + ":" + height + ":");
            });

            if (!handled) {
                if (sessionId) SessionManager.setActiveWs(sessionId, ws);
                lxcSocket.send("0:" + data.length + ":" + data);
            }
        } catch (error) {
            logger.error(`Error sending message to LXC socket`, { error: error.message, vmid });
        }
    });
};

const setupLxcMessageHandler = (lxcSocket, ws, vmid) => {
    const onMessage = (message) => {
        try {
            if (message instanceof Buffer) message = message.toString();
            if (message !== "OK" && ws.readyState === ws.OPEN) ws.send(message);
        } catch (error) {
            logger.error(`Error handling LXC socket message`, { error: error.message, vmid });
        }
    };
    lxcSocket.on("message", onMessage);
    return onMessage;
};

module.exports = async (ws, context) => {
    if (context.isShared) return handleSharedConnection(ws, context);

    const { integration, entry, containerId, ticket, node, vncTicket, auditLogId, serverSession } = context;
    const connectionStartTime = Date.now();
    const vmid = containerId ?? entry.config?.vmid ?? "0";
    const organizationId = entry?.organizationId || integration?.organizationId || null;

    let existingConnection = null;
    if (serverSession) {
        existingConnection = SessionManager.getConnection(serverSession.sessionId);
        
         if (!existingConnection) {
            const connectingPromise = SessionManager.getConnectingPromise(serverSession.sessionId);
            if (connectingPromise) {
                try {
                    await connectingPromise;
                    existingConnection = SessionManager.getConnection(serverSession.sessionId);
                } catch (err) {
                    logger.debug(`Connection promise rejected, will create new`, { sessionId: serverSession.sessionId, error: err.message });
                }
            }
        }
    }

    if (existingConnection) {
        const { lxcSocket } = existingConnection;
        const bufferedLogs = SessionManager.getLogBuffer(serverSession.sessionId);
        if (bufferedLogs && ws.readyState === ws.OPEN) {
            ws.send(bufferedLogs);
        }
        
        SessionManager.addWebSocket(serverSession.sessionId, ws);
        SessionManager.setActiveWs(serverSession.sessionId, ws);
        setupClientMessageHandler(ws, lxcSocket, vmid, serverSession.sessionId);

        const onMessage = (message) => {
            try {
                if (message instanceof Buffer) message = message.toString();
                if (message !== "OK" && ws.readyState === ws.OPEN) ws.send(message);
            } catch (error) {
                logger.error(`Error handling LXC socket message`, { error: error.message, vmid });
            }
        };
        lxcSocket.on("message", onMessage);

        const onFirstResize = (data) => {
            data = data.toString();
            if (data.startsWith("\x01")) {
                const [width, height] = data.substring(1).split(",").map(Number);
                if (!isNaN(width) && !isNaN(height)) {
                    lxcSocket.send("1:" + width + ":" + (height - 1) + ":");
                    setTimeout(() => lxcSocket.send("1:" + width + ":" + height + ":"), 50);
                    ws.removeListener("message", onFirstResize);
                }
            }
        };
        ws.on("message", onFirstResize);

        ws.on("close", () => {
            lxcSocket.removeListener("message", onMessage);
            ws.removeListener("message", onFirstResize);
            SessionManager.removeWebSocket(serverSession.sessionId, ws);
        });

        return;
    }

    let resolve, reject;
    if (serverSession) {
        SessionManager.setConnectingPromise(serverSession.sessionId, new Promise((res, rej) => { resolve = res; reject = rej; }));
    }

    let keepAliveTimer;

    try {
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

        lxcSocket.on("open", async () => {
            try {
                lxcSocket.send(`${server.username}:${vncTicket.ticket}\n`);
                keepAliveTimer = setInterval(() => {
                    if (lxcSocket.readyState === lxcSocket.OPEN) {
                        lxcSocket.send("2");
                    }
                }, 30000);

                if (serverSession) {
                    await SessionManager.initRecording(serverSession.sessionId, organizationId);
                    lxcSocket.on("message", (message) => {
                        if (message instanceof Buffer) message = message.toString();
                        if (message !== "OK") {
                            SessionManager.appendLog(serverSession.sessionId, message);
                        }
                    });
                    SessionManager.setConnection(serverSession.sessionId, { lxcSocket, keepAliveTimer, auditLogId });
                    SessionManager.addWebSocket(serverSession.sessionId, ws);
                    SessionManager.setActiveWs(serverSession.sessionId, ws);
                    resolve?.();
                }
            } catch (error) {
                logger.error(`Error during LXC socket open`, { error: error.message, vmid });
                reject?.(error);
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                lxcSocket.close();
                if (ws.readyState === ws.OPEN) {
                    ws.close(1011, "Internal server error");
                }
            }
        });

        lxcSocket.on("error", async (error) => {
            logger.error(`LXC socket error`, { error: error.message, vmid });
            reject?.(error);
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

        const onLxcData = setupLxcMessageHandler(lxcSocket, ws, vmid);
        setupClientMessageHandler(ws, lxcSocket, vmid, serverSession?.sessionId);
        
        ws.on("close", async () => {
            lxcSocket.removeListener("message", onLxcData);
            if (serverSession) SessionManager.removeWebSocket(serverSession.sessionId, ws);
            await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
        });
    } catch (error) {
        reject?.(error);
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        throw error;
    }
};
