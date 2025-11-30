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
    };

    const session = SessionManager.create(accountId, entryId, configuration, connectionReason, tabId, browserId, auditLogId);
    const { connection, ...safeSession } = session;
    return safeSession;
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

        const { connection, ...safeSession } = session;
        return {
            ...safeSession,
            organizationId: entry?.organizationId || null,
            organizationName
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

module.exports = { createSession, getSessions, hibernateSession, resumeSession, deleteSession };