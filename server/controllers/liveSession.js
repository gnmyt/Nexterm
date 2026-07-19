const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const SessionManager = require("../lib/SessionManager");
const stateBroadcaster = require("../lib/StateBroadcaster");
const { ACCOUNT_VIEW_ATTRIBUTES, toAccountView } = require("../utils/accountView");
const { Permission } = require("../permissions/registry");
const { hasOrganizationPermission } = require("../utils/permission");

const isSharingEnabled = (organization) => organization?.sessionSettings?.enableLiveSessionSharing === true;

const isJoinableSession = (session) =>
    session.configuration?.type !== "sftp" && !session.configuration?.scriptId;

const getSharingOrganizations = async (accountId) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    if (!memberships.length) return [];

    const organizations = await Organization.findAll({ where: { id: memberships.map(m => m.organizationId) } });

    const access = await Promise.all(organizations.filter(isSharingEnabled).map(async (organization) => {
        if (!(await hasOrganizationPermission(accountId, organization.id, Permission.ORG_SESSIONS_VIEW))) return null;
        const writable = await hasOrganizationPermission(accountId, organization.id, Permission.ORG_SESSIONS_CONTROL);
        return { organization, writable };
    }));

    return access.filter(Boolean);
};

const serializeSession = (session, entry, owner, organization, writable) => ({
    id: session.sessionId,
    entryId: session.entryId,
    entryName: entry?.name || null,
    organizationId: organization.id,
    organizationName: organization.name,
    type: session.configuration?.type || null,
    renderer: session.configuration?.renderer || entry?.renderer || null,
    protocol: entry?.type || null,
    icon: entry?.icon || null,
    startedAt: session.createdAt,
    owner: toAccountView(owner),
    participants: SessionManager.getParticipants(session.sessionId),
    writable,
});

const listLiveSessions = async (accountId) => {
    const organizations = await getSharingOrganizations(accountId);
    if (!organizations.length) return [];

    const sessions = [];
    for (const { organization, writable } of organizations) {
        for (const session of SessionManager.getOrganizationSessions(organization.id, accountId)) {
            if (isJoinableSession(session)) sessions.push({ session, organization, writable });
        }
    }
    if (!sessions.length) return [];

    const [entries, owners] = await Promise.all([
        Entry.findAll({
            where: { id: [...new Set(sessions.map(s => s.session.entryId))] },
            attributes: ["id", "name", "type", "icon", "renderer"],
        }),
        Account.findAll({
            where: { id: [...new Set(sessions.map(s => s.session.accountId))] },
            attributes: ACCOUNT_VIEW_ATTRIBUTES,
        }),
    ]);

    const entryMap = new Map(entries.map(e => [e.id, e]));
    const ownerMap = new Map(owners.map(o => [o.id, o]));

    return sessions.map(({ session, organization, writable }) =>
        serializeSession(session, entryMap.get(session.entryId), ownerMap.get(session.accountId), organization, writable));
};

const resolveJoinAccess = async (accountId, sessionId) => {
    const session = SessionManager.get(sessionId);
    if (!session) return { code: 404, message: "Session not found" };
    if (session.accountId === accountId) return { code: 400, message: "You already own this session" };
    if (!session.organizationId) return { code: 403, message: "This session is not shared with an organization" };
    if (!isJoinableSession(session)) return { code: 400, message: "This session type cannot be joined" };

    const organization = await Organization.findByPk(session.organizationId);
    if (!isSharingEnabled(organization)) {
        return { code: 403, message: "Live session sharing is disabled for this organization" };
    }

    if (!(await hasOrganizationPermission(accountId, session.organizationId, Permission.ORG_SESSIONS_VIEW))) {
        return { code: 403, message: "You don't have access to the live sessions of this organization" };
    }

    const writable = await hasOrganizationPermission(accountId, session.organizationId, Permission.ORG_SESSIONS_CONTROL);
    return { session, writable };
};

const revokeLiveSessionAccess = (organizationId, accountId = null) => {
    SessionManager.disconnectOrganizationViewers(organizationId, accountId);
    stateBroadcaster.broadcast("LIVE_SESSIONS", { organizationId });
};

module.exports = { listLiveSessions, resolveJoinAccess, revokeLiveSessionAccess };
