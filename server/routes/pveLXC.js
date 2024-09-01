const { openLXCConsole, getPrimaryNode, createTicket } = require("../controllers/pve");
const { WebSocket } = require("ws");
const preparePVE = require("../middlewares/pve");

module.exports = async (ws, req) => {
    const pveObj = await preparePVE(ws, req);
    if (!pveObj) return;

    const { server, containerId } = pveObj;

    let keepAliveTimer;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);

        const node = await getPrimaryNode({ ip: server.ip, port: server.port }, ticket);

        const vncTicket = await openLXCConsole({ ip: server.ip, port: server.port }, node.node, containerId, ticket);

        const containerPart = containerId === "0" ? "" : `lxc/${containerId}`;

        const lxcSocket = new WebSocket(`wss://${server.ip}:${server.port}/api2/json/nodes/${node.node}/${containerPart}/vncwebsocket?port=${vncTicket.port}&vncticket=${encodeURIComponent(vncTicket.ticket)}`, undefined, {
            rejectUnauthorized: false,
            headers: {
                "Cookie": `PVEAuthCookie=${ticket.ticket}`,
                "Authorization": `PVEAPIToken=${server.username}`,
            },
        });

        lxcSocket.on("close", () => {
            ws.close();
        });

        lxcSocket.on("open", () => {
            lxcSocket.send(server.username + ":" + ticket.ticket + "\n");
            keepAliveTimer = setInterval(() => lxcSocket.send("2"), 30000);
        });

        lxcSocket.on("error", () => {
            clearInterval(keepAliveTimer);
            lxcSocket.close();
            ws.close(1011, "Internal server error");
        });

        ws.on("close", () => {
            clearInterval(keepAliveTimer);
            lxcSocket.close();
        });

        ws.on("message", (data) => {
            data = data.toString();

            if (data.startsWith("\x01")) {
                const [width, height] = data.substring(1).split(",").map(Number);
                lxcSocket.send("1:" + width + ":" + height + ":");
            } else {
                lxcSocket.send("0:" + data.length + ":" + data);
            }
        });

        lxcSocket.on("message", (message) => {
            if (message instanceof Buffer) message = message.toString();

            if (message !== "OK") ws.send(message);
        });
    } catch (error) {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        ws.close(4005, error.message);
    }
};
