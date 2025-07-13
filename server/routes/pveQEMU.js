const { getNodeForServer, createTicket, openVNCConsole } = require("../controllers/pve");
const guacamoleProxy = require("../controllers/guacamoleProxy");
const preparePVE = require("../middlewares/pve");
const { createVNCToken } = require("../utils/tokenGenerator");

module.exports = async (ws, req) => {
    const pveObj = await preparePVE(ws, req);
    if (!pveObj) return;

    const { server, containerId, auditLogId } = pveObj;

    try {
        const ticket = await createTicket({ ip: server.ip, port: server.port }, server.username, server.password);
        const node = await getNodeForServer(server, ticket);
        const vncTicket = await openVNCConsole({ ip: server.ip, port: server.port }, node, containerId, ticket);

        const connectionConfig = createVNCToken(server.ip, vncTicket.port, undefined, vncTicket.ticket);

        if (auditLogId && req.user) {
            connectionConfig.user = req.user;
            connectionConfig.server = server;
            connectionConfig.auditLogId = auditLogId;
            connectionConfig.ipAddress = req.ip || req.socket?.remoteAddress || 'unknown';
            connectionConfig.userAgent = req.headers?.['user-agent'] || 'unknown';
            connectionConfig.connectionReason = req.query?.connectionReason || null;
        }

        guacamoleProxy(ws, connectionConfig);
    } catch (error) {
        ws.close(4005, error.message);
    }
};
