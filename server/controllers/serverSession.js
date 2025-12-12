const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const Account = require("../models/Account");
const { validateEntryAccess } = require("./entry");
const { getOrganizationAuditSettingsInternal, createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");
const { resolveIdentity } = require("../utils/identityResolver");
const Organization = require('../models/Organization');

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

const createSession = async (accountId, entryId, identityId, connectionReason, type = null, directIdentity = null, tabId = null, browserId = null, scriptId = null, ipAddress = null, userAgent = null) => {
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

    const result = await resolveIdentity(entry, identityId, directIdentity);
    const identity = result?.identity !== undefined ? result.identity : result;

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
        renderer: type === "sftp" ? "sftp" : entry.renderer,
    };

    const session = SessionManager.create(accountId, entryId, configuration, connectionReason, tabId, browserId, auditLogId);
    return { sessionId: session.sessionId };
};

const getSessions = async (accountId, tabId = null, browserId = null) => {
    const account = await Account.findByPk(accountId);
    if (!account) {
        return [];
    }

    const sessionSync = account.sessionSync || 'same_browser';
    const logger = require('../utils/logger');
    logger.info('Getting sessions', { accountId, tabId, browserId, sessionSync });
    
    let filterTabId = undefined;
    let filterBrowserId = undefined;

    if (sessionSync === 'same_tab') {
        filterTabId = tabId;
    } else if (sessionSync === 'same_browser') {
        filterBrowserId = browserId;
    }

    const sessions = SessionManager.getAll(accountId, filterTabId, filterBrowserId);
    logger.info('Sessions found', { count: sessions.length });
    

    return await Promise.all(sessions.map(async (session) => {
        const entry = await Entry.findByPk(session.entryId, {
            attributes: ['id', 'organizationId']
        });

        let organizationName = null;
        if (entry?.organizationId) {
            const org = await Organization.findByPk(entry.organizationId, {
                attributes: ['name']
            });
            organizationName = org?.name || null;
        }

        return {
            sessionId: session.sessionId,
            entryId: session.entryId,
            configuration: session.configuration,
            isHibernated: session.isHibernated,
            lastActivity: session.lastActivity,
            organizationId: entry?.organizationId || null,
            organizationName,
            shareId: session.shareId || null,
            shareWritable: session.shareWritable || false,
        };
    }));
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

module.exports = { createSession, getSessions, getSession, hibernateSession, resumeSession, deleteSession, startSharing, stopSharing, updateSharePermissions };