const Session = require("../models/Session");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Integration = require("../models/Integration");
const SessionManager = require("../lib/SessionManager");
const { validateEntryAccess } = require("../controllers/entry");
const { getOrganizationAuditSettingsInternal } = require("../controllers/audit");
const { resolveIdentity } = require("../utils/identityResolver");

const SHARED_ENTRY_ATTRIBUTES = ["id", "type", "config", "integrationId"];

const authenticateToken = async (ws, sessionToken) => {
    if (!sessionToken) return ws.close(4001, "You need to provide the token in the 'sessionToken' parameter"), null;

    const session = await Session.findOne({ where: { token: sessionToken } });
    if (!session) return ws.close(4003, "The token is not valid"), null;

    await Session.update({ lastActivity: new Date() }, { where: { id: session.id } });

    const user = await Account.findByPk(session.accountId);
    if (!user) return ws.close(4004, "The token is not valid"), null;

    return { session, user };
};

const buildSharedContext = (query, serverSession, entry, overrides) => ({
    entry,
    integration: null,
    identity: null,
    user: null,
    session: null,
    serverSession,
    containerId: "0",
    connectionReason: null,
    ipAddress: query.ip || "unknown",
    userAgent: query.userAgent || "unknown",
    isShared: true,
    ...overrides,
});

const authenticateSharedSession = async (ws, query) => {
    const { shareId } = query;
    if (!shareId) return null;

    const session = SessionManager.getByShareId(shareId);
    if (!session) return ws.close(4013, "Invalid share link"), null;

    const entry = await Entry.findByPk(session.entryId, { attributes: SHARED_ENTRY_ATTRIBUTES });
    if (!entry) return ws.close(4005, "Entry not found"), null;

    return buildSharedContext(query, session, entry, { shareWritable: session.shareWritable });
};

const authenticateOrganizationJoin = async (ws, query) => {
    const { joinSessionId } = query;
    if (!joinSessionId) return null;

    const auth = await authenticateToken(ws, query.sessionToken);
    if (!auth) return null;

    const access = await require("../controllers/liveSession").resolveJoinAccess(auth.user.id, joinSessionId);
    if (access.code) return ws.close(access.code === 404 ? 4007 : 4003, access.message), null;

    const entry = await Entry.findByPk(access.session.entryId, { attributes: SHARED_ENTRY_ATTRIBUTES });
    if (!entry) return ws.close(4005, "Entry not found"), null;

    SessionManager.updateActivity(joinSessionId);

    return buildSharedContext(query, access.session, entry, {
        user: auth.user,
        session: auth.session,
        isOrgJoin: true,
        shareWritable: access.writable,
    });
};

const authenticateWebSocket = async (ws, query) => {
    const { entryId, sessionId } = query;

    const auth = await authenticateToken(ws, query.sessionToken);
    if (!auth) return null;

    const { session, user } = auth;

    let targetEntryId = entryId;
    let serverSession = null;

    if (sessionId) {
        serverSession = SessionManager.get(sessionId);
        if (!serverSession) {
            const failedReason = SessionManager.consumeFailedReason(sessionId);
            if (failedReason) ws.close(4017, failedReason);
            else ws.close(4007, "Invalid session ID");
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

    const orgJoinAuth = await authenticateOrganizationJoin(ws, req.query);
    if (orgJoinAuth) return orgJoinAuth;

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

    const result = await resolveIdentity(entry, identityId, directIdentity, user.id);
    const identity = result?.identity !== undefined ? result.identity : result;

    if (result.accessDenied) {
        ws.close(4006, "You don't have access to this identity");
        return null;
    }

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