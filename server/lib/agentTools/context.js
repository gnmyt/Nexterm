const SessionManager = require("../SessionManager");
const Entry = require("../../models/Entry");
const logger = require("../../utils/logger");
const { createAuditLog, RESOURCE_TYPES } = require("../../controllers/audit");
const { hasResourcePermission } = require("../../utils/permission");
const { getEntryProtocol } = require("../ConnectionService");

const MAX_TEXT_CHARS = 60000;

class ToolError extends Error {
    constructor(message, code = "tool_error") {
        super(message);
        this.name = "ToolError";
        this.code = code;
    }
}

const truncate = (text, max = MAX_TEXT_CHARS) => {
    if (typeof text !== "string" || text.length <= max) return text;
    return `${text.slice(0, max)}\n… [truncated ${text.length - max} characters]`;
};

const TERMINAL_PROTOCOLS = new Set(["ssh", "telnet", "pve-lxc", "pve-shell"]);
const DESKTOP_PROTOCOLS = new Set(["rdp", "vnc", "pve-qemu", "demo"]);
const FILE_PROTOCOLS = new Set(["ssh", "sftp", "ftp", "ftps"]);

const describeSessionKind = (entry, configuration) => {
    if (configuration?.type === "sftp") return "files";
    if (configuration?.type === "web") return "desktop";
    const protocol = getEntryProtocol(entry);
    if (TERMINAL_PROTOCOLS.has(protocol)) return "terminal";
    if (DESKTOP_PROTOCOLS.has(protocol)) return "desktop";
    if (FILE_PROTOCOLS.has(protocol)) return "files";
    return "unknown";
};

const isWatchableAutomatedSession = (entry, configuration) => {
    if (configuration?.type === "web") return false;
    const kind = describeSessionKind(entry, configuration);
    return kind === "desktop" || kind === "terminal";
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createToolContext = ({
    user,
    apiKey = null,
    origin = "mcp",
    ipAddress = null,
    userAgent = null,
    allowedEntryIds = null,
    ownSessionsOnly = false,
}) => {
    const accountId = user.id;
    const ctx = {
        user,
        accountId,
        apiKey,
        origin,
        ipAddress,
        userAgent,
        allowedEntryIds: allowedEntryIds ? new Set(allowedEntryIds.map(Number)) : null,
        ownSessionsOnly,
    };

    ctx.setAllowedEntries = (ids) => {
        ctx.allowedEntryIds = ids ? new Set(ids.map(Number)) : null;
    };

    ctx.isEntryAllowed = (entryId) => !ctx.allowedEntryIds || ctx.allowedEntryIds.has(Number(entryId));

    ctx.assertEntryAllowed = (entryOrId) => {
        const entry = typeof entryOrId === "object" ? entryOrId : { id: entryOrId, name: `#${entryOrId}` };
        if (ctx.isEntryAllowed(entry.id)) return;
        throw new ToolError(
            `The user has not granted the assistant access to "${entry.name}" (entry ${entry.id}). Ask the user to add it to the servers the assistant may use.`,
            "entry_not_allowed",
        );
    };

    ctx.canUseSession = (session) => session.accountId === accountId
        && (!ctx.ownSessionsOnly || (session.automated && session.origin === origin));

    ctx.logAudit = (action, { organizationId = null, resource = null, resourceId = null, details = {} } = {}) => {
        createAuditLog({
            accountId,
            organizationId,
            action,
            resource,
            resourceId,
            details: { ...details, origin, ...(apiKey && { apiKeyId: apiKey.id, apiKeyName: apiKey.name }) },
            ipAddress,
            userAgent,
        }).catch((err) => logger.error("Failed to write agent audit log", { action, error: err.message }));
    };

    ctx.auditEntry = (entry, action, details = {}, resource = RESOURCE_TYPES.ENTRY) => ctx.logAudit(action, {
        organizationId: entry.organizationId, resource, resourceId: entry.id, details,
    });

    ctx.requireSession = (sessionId) => {
        const session = SessionManager.get(sessionId);
        if (!session) {
            const failedReason = SessionManager.consumeFailedReason(sessionId);
            throw new ToolError(failedReason ? `Session ended: ${failedReason}` : "Session not found", "session_not_found");
        }
        if (session.accountId !== accountId) throw new ToolError("Session belongs to another account", "forbidden");
        if (!ctx.canUseSession(session)) {
            throw new ToolError("This session was not opened by the assistant; open your own session with open_session", "forbidden");
        }
        SessionManager.updateActivity(sessionId);
        return session;
    };

    ctx.resolveSession = async (sessionId) => {
        const session = ctx.requireSession(sessionId);
        const entry = await Entry.findByPk(session.entryId);
        if (!entry) throw new ToolError("The entry of this session no longer exists", "entry_not_found");
        return { session, entry, protocol: getEntryProtocol(entry), kind: describeSessionKind(entry, session.configuration) };
    };

    ctx.requireResourcePermission = async (entry, permission, message) => {
        const allowed = await hasResourcePermission(accountId, entry.organizationId, permission);
        if (!allowed) throw new ToolError(message || `Missing permission: ${permission}`, "forbidden");
    };

    ctx.waitForConnection = async (sessionId, timeoutMs = 45000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const session = SessionManager.get(sessionId);
            if (!session) {
                const failedReason = SessionManager.consumeFailedReason(sessionId);
                throw new ToolError(failedReason ? `Connection failed: ${failedReason}` : "Session was closed before it connected", "connection_failed");
            }
            const conn = SessionManager.getConnection(sessionId);
            if (conn) {
                if (conn.type === "guac" && !session.guacReady) {
                    await SessionManager.waitForGuacReady(sessionId, Math.max(1000, timeoutMs - (Date.now() - start)));
                }
                return conn;
            }
            await sleep(150);
        }
        throw new ToolError("Timed out waiting for the session to connect", "timeout");
    };

    return ctx;
};

module.exports = {
    ToolError,
    truncate,
    createToolContext,
    getEntryProtocol,
    describeSessionKind,
    isWatchableAutomatedSession,
    TERMINAL_PROTOCOLS,
    DESKTOP_PROTOCOLS,
    FILE_PROTOCOLS,
    sleep,
};
