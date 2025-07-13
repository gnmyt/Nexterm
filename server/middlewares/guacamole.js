const { authorizeGuacamole } = require("./auth");
const guacamoleProxy = require("../controllers/guacamoleProxy");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

module.exports = async (req, res) => {
    const settings = await authorizeGuacamole(req);
    if (!settings) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    let auditLogId = null;
    if (settings.user && settings.server) {
        const actionType = settings.server.protocol === "rdp" ? AUDIT_ACTIONS.RDP_CONNECT : AUDIT_ACTIONS.VNC_CONNECT;

        auditLogId = await createAuditLog({
            accountId: settings.user.id,
            organizationId: settings.server.organizationId,
            action: actionType,
            resource: RESOURCE_TYPES.SERVER,
            resourceId: settings.server.id,
            details: { connectionReason: settings.connectionReason },
            ipAddress: settings.ipAddress,
            userAgent: settings.userAgent,
        });

        settings.auditLogId = auditLogId;
    }

    guacamoleProxy(req.ws, settings);
};