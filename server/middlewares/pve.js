const Session = require("../models/Session");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const { validateEntryAccess } = require("../controllers/entry");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES, getOrganizationAuditSettingsInternal } = require("../controllers/audit");

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

    const entry = await Entry.findByPk(serverId);
    if (entry === null) return;

    if (!((await validateEntryAccess(req.user.id, entry)).valid)) {
        ws.close(4005, "You don't have access to this server");
        return;
    }

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;

    if (entry.organizationId && req.user.id) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            ws.close(4008, "Connection reason required");
            return;
        }
    }

    console.log("Authorized connection to pve server " + integration?.config?.ip + " with container " + containerId);

    let auditLogId = null;
    if (req.user.id) {
        auditLogId = await createAuditLog({
            accountId: req.user.id,
            organizationId: entry.organizationId,
            action: AUDIT_ACTIONS.PVE_CONNECT,
            resource: RESOURCE_TYPES.SERVER,
            resourceId: entry.id,
            details: {
                containerId: containerId,
                containerType: 'lxc',
                connectionReason: connectionReason,
            },
            ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
        });
    }

    return { server: { ...integration, ...entry.config }, entry, integration, containerId, auditLogId };
}