const { openLXCConsole, getNodeForServer, createTicket } = require("../controllers/pve");
const { WebSocket } = require("ws");
const preparePVE = require("../middlewares/pve");

module.exports = async (ws, req) => {
    const pveObj = await preparePVE(ws, req);
    if (!pveObj) return;

    const { server, containerId } = pveObj;

    let keepAliveTimer;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);

        const node = await getNodeForServer(server, ticket);

        const vncTicket = await openLXCConsole({ ip: server.ip, port: server.port }, node, containerId, ticket);

        const containerPart = containerId === "0" ? "" : `lxc/${containerId}`;

        const lxcSocket = new WebSocket(`wss://${server.ip}:${server.port}/api2/json/nodes/${node}/${containerPart}/vncwebsocket?port=${vncTicket.port}&vncticket=${encodeURIComponent(vncTicket.ticket)}`, undefined, {
            rejectUnauthorized: false,
            headers: {
                "Cookie": `PVEAuthCookie=${ticket.ticket}`,
            },
        });

        lxcSocket.on("close", () => {
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

        lxcSocket.on("error", (error) => {
            console.error("LXC socket error:", error.message);
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            if (lxcSocket.readyState === lxcSocket.OPEN) {
                lxcSocket.close();
            }
            if (ws.readyState === ws.OPEN) {
                ws.close(1011, "Internal server error");
            }
        });

        ws.on("close", () => {
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
                    const [width, height] = data.substring(1).split(",").map(Number);
                    lxcSocket.send("1:" + width + ":" + height + ":");
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
        ws.close(4005, error.message);
    }
};
