const Session = require("../models/Session");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const { validateEntryAccess } = require("../controllers/entry");
const { getOrganizationAuditSettingsInternal } = require("../controllers/audit");

const authenticateWebSocket = async (ws, query) => {
    const { sessionToken, entryId } = query;

    if (!sessionToken) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
        return null;
    }

    if (!entryId) {
        ws.close(4002, "You need to provide the entryId in the 'entryId' parameter");
        return null;
    }

    const session = await Session.findOne({ where: { token: sessionToken } });
    if (!session) {
        ws.close(4003, "The token is not valid");
        return null;
    }

    await Session.update({ lastActivity: new Date() }, { where: { id: session.id } });

    const user = await Account.findByPk(session.accountId);
    if (!user) {
        ws.close(4004, "The token is not valid");
        return null;
    }

    const entry = await Entry.findByPk(entryId);
    if (!entry) {
        ws.close(4005, "Entry not found");
        return null;
    }

    const accessResult = await validateEntryAccess(user.id, entry);
    if (!accessResult.valid) {
        ws.close(4005, "You don't have access to this entry");
        return null;
    }

    return { user, entry, session };
}

module.exports = async (ws, req) => {
    const baseAuth = await authenticateWebSocket(ws, req.query);
    if (!baseAuth) return null;

    const { user, entry, session } = baseAuth;
    const { identityId, connectionReason, containerId } = req.query;

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;

    if (entry.organizationId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            ws.close(4008, "Connection reason required");
            return null;
        }
    }

    let identity = null;
    const isPveEntry = entry.type?.startsWith('pve-');
    
    if (identityId) {
        identity = await Identity.findByPk(identityId);
    } else {
        const entryIdentities = await EntryIdentity.findAll({ 
            where: { entryId: entry.id }, 
            order: [['isDefault', 'DESC']] 
        });
        if (entryIdentities.length > 0) {
            identity = await Identity.findByPk(entryIdentities[0].identityId);
        }
    }

    if (!identity && !isPveEntry) {
        ws.close(4006, "Identity not found");
        return null;
    }

    return {
        entry,
        integration,
        identity,
        user,
        session,
        containerId: containerId || "0",
        connectionReason: connectionReason || null,
        ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
    };
};

module.exports.authenticateWebSocket = authenticateWebSocket;