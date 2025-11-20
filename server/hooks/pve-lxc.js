const { WebSocket } = require("ws");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");

module.exports = async (ws, context) => {
    const { integration, entry, containerId, ticket, node, vncTicket, auditLogId } = context;
    const connectionStartTime = Date.now();

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
        });

        lxcSocket.on("open", () => {
            try {
                lxcSocket.send(`${server.username}:${vncTicket.ticket}\n`);
                keepAliveTimer = setInterval(() => {
                    if (lxcSocket.readyState === lxcSocket.OPEN) {
                        lxcSocket.send("2");
                    }
                }, 30000);
            } catch (error) {
                console.error("Error during LXC socket open:", error.message);
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                lxcSocket.close();
                if (ws.readyState === ws.OPEN) {
                    ws.close(1011, "Internal server error");
                }
            }
        });

        lxcSocket.on("error", async (error) => {
            console.error("LXC socket error:", error.message);
            await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (lxcSocket.readyState === lxcSocket.OPEN) {
                lxcSocket.close();
            }
            if (ws.readyState === ws.OPEN) {
                ws.close(1011, "Internal server error");
            }
        });

        ws.on("close", async () => {
            await updateAuditLogWithSessionDuration(auditLogId, connectionStartTime);
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (lxcSocket.readyState === lxcSocket.OPEN) {
                lxcSocket.close();
            }
        });

        ws.on("message", (data) => {
            try {
                data = data.toString();

                if (lxcSocket.readyState !== lxcSocket.OPEN) {
                    console.warn("Attempted to send data to closed LXC socket");
                    return;
                }

                if (data.startsWith("\x01")) {
                    const resizeData = data.substring(1);
                    if (resizeData.includes(",")) {
                        const [width, height] = resizeData.split(",").map(Number);
                        if (!isNaN(width) && !isNaN(height)) {
                            lxcSocket.send("1:" + width + ":" + height + ":");
                            return;
                        }
                    }
                    lxcSocket.send("0:" + data.length + ":" + data);
                } else {
                    lxcSocket.send("0:" + data.length + ":" + data);
                }
            } catch (error) {
                console.error("Error sending message to LXC socket:", error.message);
            }
        });

        lxcSocket.on("message", (message) => {
            try {
                if (message instanceof Buffer) message = message.toString();

                if (message !== "OK" && ws.readyState === ws.OPEN) {
                    ws.send(message);
                }
            } catch (error) {
                console.error("Error handling LXC socket message:", error.message);
            }
        });
    } catch (error) {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        throw error;
    }
};
