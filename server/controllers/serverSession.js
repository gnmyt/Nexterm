const SessionManager = require("../lib/SessionManager");
const { createConnectionForSession } = require("../lib/ConnectionService");
const Entry = require("../models/Entry");
const Account = require("../models/Account");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const { validateEntryAccess } = require("./entry");
const { getIdentityCredentials, getIdentity } = require("./identity");
const { getOrganizationAuditSettingsInternal, createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");
const { resolveIdentity } = require("../utils/identityResolver");
const Organization = require('../models/Organization');
const logger = require("../utils/logger");
const stateBroadcaster = require("../lib/StateBroadcaster");

const ENTRY_TYPE_TO_AUDIT_ACTION = {
    'ssh': AUDIT_ACTIONS.SSH_CONNECT,
    'telnet': AUDIT_ACTIONS.SSH_CONNECT,
    'rdp': AUDIT_ACTIONS.RDP_CONNECT,
    'vnc': AUDIT_ACTIONS.VNC_CONNECT,
    'pve-lxc': AUDIT_ACTIONS.PVE_CONNECT,
    'pve-shell': AUDIT_ACTIONS.PVE_CONNECT,
    'pve-qemu': AUDIT_ACTIONS.PVE_CONNECT,
};

const getAuditAction = (entry, scriptId) => {
    if (scriptId) return AUDIT_ACTIONS.SCRIPT_EXECUTE;
    const type = entry.type === 'server' ? entry.config?.protocol : entry.type;
    return ENTRY_TYPE_TO_AUDIT_ACTION[type] || AUDIT_ACTIONS.SSH_CONNECT;
};

const createSession = async (accountId, entryId, identityId, connectionReason, type = null, directIdentity = null, tabId = null, browserId = null, scriptId = null, startPath = null, ipAddress = null, userAgent = null) => {
    const entry = await Entry.findByPk(entryId);
    if (!entry) {
        return { code: 404, message: "Entry not found" };
    }

    const accessResult = await validateEntryAccess(accountId, entry);
    if (!accessResult.valid) {
        return { code: 403, message: "Access denied" };
    }

    if (directIdentity && entry.type?.startsWith('pve-')) {
        return { code: 400, message: "Direct connections are not supported for Proxmox entries" };
    }

    if (entry.organizationId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            return { code: 400, message: "Connection reason required" };
        }
    }

    const result = await resolveIdentity(entry, identityId, directIdentity, accountId);
    const identity = result?.identity !== undefined ? result.identity : result;

    if (result.accessDenied) {
        return { code: 403, message: "You don't have access to this identity" };
    }

    if (result.requiresIdentity && !identity) {
        return { code: 400, message: "Identity not found" };
    }

    const auditLogId = await createAuditLog({
        accountId,
        organizationId: entry.organizationId,
        action: getAuditAction(entry, scriptId),
        resource: scriptId ? RESOURCE_TYPES.SCRIPT : RESOURCE_TYPES.ENTRY,
        resourceId: scriptId || entry.id,
        details: { connectionReason, ...(scriptId && { serverId: entry.id }) },
        ipAddress,
        userAgent,
    });

    const configuration = {
        identityId: identity ? identity.id : null,
        type: type || null,
        directIdentity: directIdentity || null,
        scriptId: scriptId || null,
        startPath: startPath || null,
        renderer: type === "sftp" ? "sftp" : entry.renderer,
    };

    const session = SessionManager.create(accountId, entryId, configuration, connectionReason, tabId, browserId, auditLogId);

    stateBroadcaster.broadcast("CONNECTIONS", { accountId });

    createConnectionForSession(session.sessionId, accountId)
        .then(() => {
            logger.info("Session connection established", { sessionId: session.sessionId, entryId, type: entry.type });
        })
        .catch((error) => {
            logger.error("Failed to create connection for session", { 
                sessionId: session.sessionId, 
                error: error.message,
                stack: error.stack
            });
            // Broadcast the failure so the frontend knows this specific session failed
            stateBroadcaster.broadcast("SESSION_ERROR", { 
                accountId, 
                sessionId: session.sessionId, 
                message: error.message || "Connection Failed" 
            });
            SessionManager.remove(session.sessionId);
        });

    return { sessionId: session.sessionId };
};

const getSessions = async (accountId, tabId = null, browserId = null) => {
    const account = await Account.findByPk(accountId);
    if (!account) return [];

    const sessionSync = account.sessionSync || 'same_browser';
    let filterTabId, filterBrowserId;
    if (sessionSync === 'same_tab') filterTabId = tabId;
    else if (sessionSync === 'same_browser') filterBrowserId = browserId;

    const sessions = SessionManager.getAll(accountId, filterTabId, filterBrowserId);
    if (!sessions.length) return [];

    const entryIds = [...new Set(sessions.map(s => s.entryId))];
    const [entries, snapshots] = await Promise.all([
        Entry.findAll({ where: { id: entryIds }, attributes: ['id', 'organizationId'] }),
        MonitoringSnapshot.findAll({ where: { entryId: entryIds }, attributes: ['entryId', 'osInfo'] }),
    ]);

    const entryMap = Object.fromEntries(entries.map(e => [e.id, e]));
    const snapshotMap = Object.fromEntries(snapshots.map(s => [s.entryId, s.osInfo?.name || null]));

    const orgIds = [...new Set(entries.filter(e => e.organizationId).map(e => e.organizationId))];
    const orgs = orgIds.length ? await Organization.findAll({ where: { id: orgIds }, attributes: ['id', 'name'] }) : [];
    const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]));

    return sessions.map(session => {
        const entry = entryMap[session.entryId];
        const { directIdentity, ...safeConfiguration } = session.configuration;
        return {
            sessionId: session.sessionId,
            entryId: session.entryId,
            configuration: safeConfiguration,
            isHibernated: session.isHibernated,
            lastActivity: session.lastActivity,
            organizationId: entry?.organizationId || null,
            organizationName: entry?.organizationId ? orgMap[entry.organizationId] || null : null,
            osName: snapshotMap[session.entryId] || null,
            shareId: session.shareId || null,
            shareWritable: session.shareWritable || false,
        };
    });
};

const hibernateSession = (sessionId) => {
    const success = SessionManager.hibernate(sessionId);
    if (success) {
        return { message: "Session hibernated" };
    }
    return { code: 404, message: "Session not found" };
};

const resumeSession = (sessionId, tabId = null, browserId = null) => {
    const success = SessionManager.resume(sessionId, tabId, browserId);
    if (success) {
        return { message: "Session resumed" };
    }
    return { code: 404, message: "Session not found" };
};

const deleteSession = (sessionId) => {
    const success = SessionManager.remove(sessionId);
    if (success) {
        return { message: "Session deleted" };
    }
    return { code: 404, message: "Session not found" };
};

const getSession = async (accountId, sessionId) => {
    const session = SessionManager.get(sessionId);
    if (!session) {
        return { code: 404, message: "Session not found" };
    }

    if (session.accountId !== accountId) {
        return { code: 403, message: "Access denied" };
    }

    const entry = await Entry.findByPk(session.entryId);
    if (!entry) {
        return { code: 404, message: "Entry not found" };
    }

    let organizationName = null;
    if (entry.organizationId) {
        const org = await Organization.findByPk(entry.organizationId, {
            attributes: ['name']
        });
        organizationName = org?.name || null;
    }

    const server = {
        id: entry.id,
        name: entry.name,
        type: entry.type,
        icon: entry.icon,
        renderer: entry.renderer,
        protocol: entry.config?.protocol,
    };

    return {
        id: session.sessionId,
        server,
        identity: session.configuration.identityId,
        isHibernated: session.isHibernated,
        lastActivity: session.lastActivity,
        type: session.configuration.type || undefined,
        organizationId: entry.organizationId || null,
        organizationName,
        scriptId: session.configuration.scriptId || undefined,
        shareId: session.shareId || null,
        shareWritable: session.shareWritable || false,
    };
};

const validateSessionOwnership = (accountId, sessionId) => {
    const session = SessionManager.get(sessionId);
    if (!session) return { error: { code: 404, message: "Session not found" } };
    if (session.accountId !== accountId) return { error: { code: 403, message: "Access denied" } };
    return { session };
};

const startSharing = (accountId, sessionId, writable = false) => {
    const { error } = validateSessionOwnership(accountId, sessionId);
    if (error) return error;
    return { shareId: SessionManager.startSharing(sessionId, writable), writable };
};

const stopSharing = (accountId, sessionId) => {
    const { error } = validateSessionOwnership(accountId, sessionId);
    if (error) return error;
    SessionManager.stopSharing(sessionId);
    return { message: "Sharing stopped" };
};

const updateSharePermissions = (accountId, sessionId, writable) => {
    const { session, error } = validateSessionOwnership(accountId, sessionId);
    if (error) return error;
    if (!session.shareId) return { code: 400, message: "Session is not being shared" };
    SessionManager.updateSharePermissions(sessionId, writable);
    return { writable };
};

const duplicateSession = async (accountId, sessionId, tabId = null, browserId = null, ipAddress = null, userAgent = null) => {
    const session = SessionManager.get(sessionId);
    if (!session) {
        return { code: 404, message: "Session not found" };
    }

    if (session.accountId !== accountId) {
        return { code: 403, message: "Access denied" };
    }

    const entry = await Entry.findByPk(session.entryId);
    if (!entry) {
        return { code: 404, message: "Entry not found" };
    }

    const config = session.configuration || {};
    
    return await createSession(
        accountId,
        session.entryId,
        config.identityId,
        null,
        config.type,
        config.directIdentity,
        tabId,
        browserId,
        config.scriptId,
        ipAddress,
        userAgent
    );
};

const pasteIdentityPassword = async (accountId, sessionId, ipAddress = null, userAgent = null) => {
    const { session, error } = validateSessionOwnership(accountId, sessionId);
    if (error) return error;

    const identityId = session.configuration?.identityId;
    if (!identityId) return { code: 400, message: 'No identity attached to session' };

    const identity = await getIdentity(accountId, identityId);
    if (identity?.code) return identity;

    const creds = await getIdentityCredentials(identityId);
    const password = creds?.password;
    if (!password) return { code: 400, message: 'Identity does not contain a password' };

    const connection = SessionManager.getConnection(sessionId);
    if (!connection || !connection.stream) return { code: 400, message: 'Session stream not available' };

    const entry = await Entry.findByPk(session.entryId);

    try {
        connection.stream.write(password);

        await createAuditLog({
            accountId,
            organizationId: entry?.organizationId || null,
            action: AUDIT_ACTIONS.IDENTITY_CREDENTIALS_ACCESS,
            resource: RESOURCE_TYPES.IDENTITY,
            resourceId: identity.id,
            details: { identityName: identity.name, identityType: identity.type },
            ipAddress,
            userAgent,
        });

        return { message: 'Password pasted' };
    } catch (e) {
        console.error('Failed to paste identity password', e);
        return { code: 500, message: 'Failed to paste password' };
    }
};

module.exports = { createSession, getSessions, getSession, hibernateSession, resumeSession, deleteSession, startSharing, stopSharing, updateSharePermissions, duplicateSession, pasteIdentityPassword };