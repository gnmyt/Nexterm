const Session = require("../models/Session");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const SessionManager = require("../lib/SessionManager");
const { validateEntryAccess } = require("../controllers/entry");
const { getOrganizationAuditSettingsInternal } = require("../controllers/audit");
const { resolveIdentity } = require("../utils/identityResolver");

const authenticateSharedSession = async (ws, query) => {
    const { shareId } = query;
    if (!shareId) return null;

    const session = SessionManager.getByShareId(shareId);
    if (!session) return ws.close(4013, "Invalid share link"), null;

    const entry = await Entry.findByPk(session.entryId, { attributes: ['id', 'type', 'config', 'integrationId'] });
    if (!entry) return ws.close(4005, "Entry not found"), null;

    return {
        entry,
        integration: null,
        identity: null,
        user: null,
        session: null,
        serverSession: session,
        containerId: "0",
        connectionReason: null,
        ipAddress: query.ip || "unknown",
        userAgent: query.userAgent || "unknown",
        isShared: true,
        shareWritable: session.shareWritable,
    };
};

const authenticateWebSocket = async (ws, query) => {
    const { sessionToken, entryId, sessionId } = query;

    if (!sessionToken) {
        ws.close(4001, "You need to provide the token in the 'sessionToken' parameter");
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

    let targetEntryId = entryId;
    let serverSession = null;

    if (sessionId) {
        serverSession = SessionManager.get(sessionId);
        if (!serverSession) {
            ws.close(4007, "Invalid session ID");
            return null;
        }
        if (serverSession.accountId !== user.id) {
            ws.close(4003, "Unauthorized session access");
            return null;
        }
        targetEntryId = serverSession.entryId;
        SessionManager.updateActivity(sessionId);
    }

    if (!targetEntryId) {
        ws.close(4002, "You need to provide the entryId or sessionId");
        return null;
    }

    const entry = await Entry.findByPk(targetEntryId);
    if (!entry) {
        ws.close(4005, "Entry not found");
        return null;
    }

    const accessResult = await validateEntryAccess(user.id, entry);
    if (!accessResult.valid) {
        ws.close(4005, "You don't have access to this entry");
        return null;
    }

    return { user, entry, session, serverSession };
}

module.exports = async (ws, req) => {
    const sharedAuth = await authenticateSharedSession(ws, req.query);
    if (sharedAuth) return sharedAuth;

    const baseAuth = await authenticateWebSocket(ws, req.query);
    if (!baseAuth) return null;

    const { user, entry, session, serverSession } = baseAuth;
    let { identityId, connectionReason, containerId } = req.query;
    let directIdentity = null;

    if (serverSession) {
        if (serverSession.configuration?.identityId) identityId = serverSession.configuration.identityId;
        if (serverSession.configuration?.directIdentity) directIdentity = serverSession.configuration.directIdentity;
        if (serverSession.connectionReason) connectionReason = serverSession.connectionReason;
    }

    const integration = entry.integrationId ? await Integration.findByPk(entry.integrationId) : null;

    if (entry.organizationId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            ws.close(4008, "Connection reason required");
            return null;
        }
    }

    const result = await resolveIdentity(entry, identityId, directIdentity);
    const identity = result?.identity !== undefined ? result.identity : result;

    if (result.requiresIdentity && !identity) {
        ws.close(4006, "Identity not found");
        return null;
    }

    return {
        entry,
        integration,
        identity,
        user,
        session,
        serverSession,
        containerId: containerId || "0",
        connectionReason: connectionReason || null,
        ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
    };
};

module.exports.authenticateWebSocket = authenticateWebSocket;