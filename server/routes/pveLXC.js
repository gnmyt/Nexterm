const Session = require("../models/Session");
const Account = require("../models/Account");
const PVEServer = require("../models/PVEServer");
const { openLXCConsole, getPrimaryNode, createTicket } = require("../controllers/pve");
const { WebSocket } = require("ws");

module.exports = async (ws, req) => {
    const authHeader = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    let containerId = req.query["containerId"];

    if (!authHeader) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
        return;
    }

    if (!serverId) {
        ws.close(4002, "You need to provide the serverId in the 'serverId' parameter");
        return;
    }

    if (!containerId) {
        containerId = "0";
    }

    req.session = await Session.findOne({ where: { token: authHeader } });
    if (req.session === null) {
        ws.close(4003, "The token is not valid");
        return;
    }

    await Session.update({ lastActivity: new Date() }, { where: { id: req.session.id } });

    req.user = await Account.findByPk(req.session.accountId);
    if (req.user === null) {
        ws.close(4004, "The token is not valid");
        return;
    }

    const server = await PVEServer.findByPk(serverId);
    if (server === null) return;

    console.log("Authorized connection to pve server " + server.ip + " with container " + containerId);

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
