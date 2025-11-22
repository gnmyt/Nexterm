const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const { validateEntryAccess } = require("./entry");
const { getOrganizationAuditSettingsInternal } = require("./audit");
const { resolveIdentity } = require("../utils/identityResolver");

const createSession = async (accountId, entryId, identityId, connectionReason) => {
    const entry = await Entry.findByPk(entryId);
    if (!entry) {
        return { code: 404, message: "Entry not found" };
    }

    const accessResult = await validateEntryAccess(accountId, entry);
    if (!accessResult.valid) {
        return { code: 403, message: "Access denied" };
    }

    if (entry.organizationId) {
        const auditSettings = await getOrganizationAuditSettingsInternal(entry.organizationId);
        if (auditSettings?.requireConnectionReason && !connectionReason) {
            return { code: 400, message: "Connection reason required" };
        }
    }

    const result = await resolveIdentity(entry, identityId);
    const identity = result.identity || result;

    if (result.requiresIdentity && !identity) {
        return { code: 400, message: "Identity not found" };
    }

    const configuration = {
        identityId: identity ? identity.id : null,
    };

    const session = SessionManager.create(accountId, entryId, configuration, connectionReason);
    const { connection, ...safeSession } = session;
    return safeSession;
};

const getSessions = (accountId) => {
    const sessions = SessionManager.getAll(accountId);
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

const resumeSession = (sessionId) => {
    const success = SessionManager.resume(sessionId);
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