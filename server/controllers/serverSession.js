const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const Account = require("../models/Account");
const { validateEntryAccess } = require("./entry");
const { getOrganizationAuditSettingsInternal } = require("./audit");
const { resolveIdentity } = require("../utils/identityResolver");

const createSession = async (accountId, entryId, identityId, connectionReason, type = null, directIdentity = null, tabId = null, browserId = null) => {
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

    const configuration = {
        identityId: identity ? identity.id : null,
        type: type || null,
        directIdentity: directIdentity || null,
    };

    const session = SessionManager.create(accountId, entryId, configuration, connectionReason, tabId, browserId);
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
    return sessions.map(session => {
        const { connection, ...safeSession } = session;
        return safeSession;
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

module.exports = { createSession, getSessions, hibernateSession, resumeSession, deleteSession };