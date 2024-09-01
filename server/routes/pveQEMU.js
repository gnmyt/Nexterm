const { getPrimaryNode, createTicket, openVNCConsole } = require("../controllers/pve");
const guacamoleProxy = require("../controllers/guacamoleProxy");
const preparePVE = require("../middlewares/pve");
const { createVNCToken } = require("../utils/tokenGenerator");

module.exports = async (ws, req) => {
    const pveObj = await preparePVE(ws, req);
    if (!pveObj) return;

    const { server, containerId } = pveObj;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
        const node = await getPrimaryNode({ ip: server.ip, port: server.port }, ticket);
        const vncTicket = await openVNCConsole({ ip: server.ip, port: server.port }, node.node, containerId, ticket);

        guacamoleProxy(ws, createVNCToken(server.ip, vncTicket.port, undefined, vncTicket.ticket));
    } catch (error) {
        ws.close(4005, error.message);
    }
};
