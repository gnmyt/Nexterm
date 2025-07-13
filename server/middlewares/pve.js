const Session = require("../models/Session");
const Account = require("../models/Account");
const PVEServer = require("../models/PVEServer");
const { validateServerAccess } = require("../controllers/server");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

module.exports = async (ws, req) => {
    const authHeader = req.query["sessionToken"];
    const serverId = req.query["serverId"];
    const connectionReason = req.query["connectionReason"];
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

    if (!((await validateServerAccess(req.user.id, server)).valid)) {
        ws.close(4005, "You don't have access to this server");
        return;
    }

    console.log("Authorized connection to pve server " + server.ip + " with container " + containerId);

    let auditLogId = null;
    if (req.user.id) {
        auditLogId = await createAuditLog({
            accountId: req.user.id,
            organizationId: server.organizationId,
            action: AUDIT_ACTIONS.PVE_CONNECT,
            resource: RESOURCE_TYPES.SERVER,
            resourceId: server.id,
            details: {
                containerId: containerId,
                containerType: 'lxc',
                connectionReason: connectionReason,
            },
            ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
        });
    }

    return { server, containerId, auditLogId };
}