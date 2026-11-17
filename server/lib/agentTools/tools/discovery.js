const { z } = require("zod");
const { ToolError, getEntryProtocol, describeSessionKind } = require("../context");
const { listEntries, getEntry } = require("../../../controllers/entry");
const { listFolders } = require("../../../controllers/folder");
const { listOrganizations } = require("../../../controllers/organization");
const { listIdentities } = require("../../../controllers/identity");
const { listAllAccessibleSnippets } = require("../../../controllers/snippet");
const { listAllAccessibleScripts } = require("../../../controllers/script");
const { listTags } = require("../../../controllers/tag");
const { listUsers } = require("../../../controllers/account");
const { getServerMonitoring, getAllServersMonitoring } = require("../../../controllers/monitoring");
const { getSystemPermissions, getOrganizationPermissions } = require("../../../permissions/engine");
const { hasAccountPermission } = require("../../../utils/permission");
const { Permission } = require("../../../permissions/registry");
const OrganizationMember = require("../../../models/OrganizationMember");
const Entry = require("../../../models/Entry");
const SessionManager = require("../../SessionManager");

const flattenEntries = (nodes, path = [], organization = null, out = []) => {
    for (const node of nodes) {
        if (node.type === "folder") {
            flattenEntries(node.entries || [], [...path, node.name], organization, out);
        } else if (node.type === "organization") {
            const org = { id: Number.parseInt(String(node.id).split("-")[1], 10), name: node.name };
            flattenEntries(node.entries || [], path, org, out);
        } else {
            out.push({
                id: node.id,
                name: node.name,
                type: node.type,
                protocol: node.protocol || (node.type?.startsWith("pve-") ? node.type : null),
                ip: node.ip,
                status: node.status || null,
                icon: node.icon,
                folderPath: path.join("/") || null,
                organizationId: organization?.id ?? null,
                organizationName: organization?.name ?? null,
                identities: node.identities || [],
                tags: node.tags || [],
                integrationId: node.integrationId,
                notes: node.notes || undefined,
            });
        }
    }
    return out;
};

const ENTRY_SUMMARY_ATTRIBUTES = ["id", "name", "type", "config"];

const summarize = (session, entry) => {
    const conn = SessionManager.getConnection(session.sessionId);
    return {
        sessionId: session.sessionId,
        entryId: session.entryId,
        entryName: entry?.name || null,
        protocol: entry ? getEntryProtocol(entry) : null,
        kind: entry ? describeSessionKind(entry, session.configuration) : "unknown",
        type: session.configuration?.type || null,
        automated: session.automated,
        origin: session.origin || null,
        status: conn ? "connected" : "connecting",
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        organizationId: session.organizationId || null,
    };
};

const sessionSummary = async (session) => summarize(session, await Entry.findByPk(session.entryId, { attributes: ENTRY_SUMMARY_ATTRIBUTES }));

const summarizeSessions = async (sessions) => {
    if (!sessions.length) return [];
    const ids = [...new Set(sessions.map((session) => session.entryId))];
    const entries = await Entry.findAll({ where: { id: ids }, attributes: ENTRY_SUMMARY_ATTRIBUTES });
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return sessions.map((session) => summarize(session, byId.get(Number(session.entryId))));
};

const getActiveOrganizationIds = async (accountId) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    return memberships.map((m) => m.organizationId);
};

module.exports = (define, ctx) => {
    define("list_entries", {
        title: "List servers and entries",
        description: "Lists every server / connection entry the authenticated account can access (SSH, Telnet, RDP, VNC, SFTP, Proxmox). "
            + "Returns a flat list with the entry id, protocol, folder path, organization, attached identity ids and tags. "
            + "Use the entry id with open_session or exec_command.",
        inputSchema: {
            search: z.string().optional().describe("Case-insensitive filter on name, host/IP or folder path."),
            protocol: z.string().optional().describe("Only return entries with this protocol, e.g. ssh, rdp, vnc, telnet, sftp, pve-lxc, pve-qemu."),
            organizationId: z.number().int().optional().describe("Only return entries of this organization (omit for all, use 0 for personal entries)."),
        },
        annotations: { readOnlyHint: true },
    }, async ({ search, protocol, organizationId }) => {
        const tree = await listEntries(ctx.accountId);
        let entries = flattenEntries(tree).filter((e) => ctx.isEntryAllowed(e.id));
        if (protocol) entries = entries.filter((e) => e.protocol === protocol);
        if (organizationId !== undefined) entries = entries.filter((e) => (e.organizationId ?? 0) === organizationId);
        if (search) {
            const needle = search.toLowerCase();
            entries = entries.filter((e) => [e.name, e.ip, e.folderPath, e.organizationName]
                .some((v) => typeof v === "string" && v.toLowerCase().includes(needle)));
        }
        return { count: entries.length, entries };
    });

    define("get_entry", {
        title: "Get entry details",
        description: "Returns the full configuration of a single entry (host, port, protocol settings, jump hosts, attached identities). Credentials are never returned.",
        inputSchema: { entryId: z.number().int().describe("Entry id from list_entries.") },
        annotations: { readOnlyHint: true },
    }, async ({ entryId }) => {
        ctx.assertEntryAllowed(entryId);
        const entry = await getEntry(ctx.accountId, entryId);
        if (entry?.code) throw new ToolError(entry.message, "entry_not_found");
        return entry;
    });

    define("list_folders", {
        title: "List folders and organizations",
        description: "Returns the folder tree (personal folders and organization folders) without the entries inside them.",
        annotations: { readOnlyHint: true },
    }, async () => {
        const strip = (nodes) => nodes.map((n) => ({
            id: n.id, name: n.name, type: n.type, organizationId: n.organizationId ?? null,
            folderType: n.folderType, children: strip((n.entries || []).filter((c) => c.type === "folder" || c.type === "organization")),
        }));
        return strip(await listFolders(ctx.accountId));
    });

    define("list_organizations", {
        title: "List organizations",
        description: "Lists the organizations the account is a member of together with the permissions the account holds in each.",
        annotations: { readOnlyHint: true },
    }, async () => (await listOrganizations(ctx.accountId)).map((o) => ({
        id: o.id, name: o.name, description: o.description, isOwner: o.isOwner, permissions: o.permissions,
    })));

    define("list_identities", {
        title: "List identities",
        description: "Lists the login identities (usernames / key types) the account can use. Secrets are never returned. Pass an identity id to open_session to choose a specific login.",
        annotations: { readOnlyHint: true },
    }, async () => listIdentities(ctx.accountId));

    define("list_snippets", {
        title: "List command snippets",
        description: "Lists saved command snippets (personal and organization). Useful to discover commonly used commands.",
        annotations: { readOnlyHint: true },
    }, async () => {
        const snippets = await listAllAccessibleSnippets(ctx.accountId, await getActiveOrganizationIds(ctx.accountId));
        return snippets.map((s) => ({ id: s.id, name: s.name, command: s.command, description: s.description, organizationId: s.organizationId }));
    });

    define("list_scripts", {
        title: "List scripts",
        description: "Lists the automation scripts (personal and organization) with their content.",
        annotations: { readOnlyHint: true },
    }, async () => {
        const scripts = await listAllAccessibleScripts(ctx.accountId, await getActiveOrganizationIds(ctx.accountId));
        return scripts.map((s) => ({ id: s.id, name: s.name, description: s.description, content: s.content, organizationId: s.organizationId }));
    });

    define("list_tags", {
        title: "List tags",
        description: "Lists the tags that can be attached to entries.",
        annotations: { readOnlyHint: true },
    }, async () => (await listTags(ctx.accountId)).map((t) => ({ id: t.id, name: t.name, color: t.color })));

    define("list_users", {
        title: "List user accounts",
        description: "Lists the user accounts of this Nexterm instance. Requires the users.view permission.",
        inputSchema: {
            search: z.string().optional().describe("Filter by username or name."),
            limit: z.number().int().positive().max(200).optional(),
            offset: z.number().int().min(0).optional(),
        },
        annotations: { readOnlyHint: true },
    }, async ({ search, limit, offset }) => {
        if (!(await hasAccountPermission(ctx.accountId, Permission.USERS_VIEW))) {
            throw new ToolError("You do not have permission to list users (users.view)", "forbidden");
        }
        return listUsers({ search, limit, offset });
    });

    define("get_permissions", {
        title: "Get my permissions",
        description: "Returns the system permissions of the authenticated account and, optionally, its permissions inside an organization.",
        inputSchema: { organizationId: z.number().int().optional() },
        annotations: { readOnlyHint: true },
    }, async ({ organizationId }) => {
        const system = await getSystemPermissions(ctx.accountId);
        const result = {
            account: { id: ctx.user.id, username: ctx.user.username, firstName: ctx.user.firstName, lastName: ctx.user.lastName },
            apiKey: ctx.apiKey ? { id: ctx.apiKey.id, name: ctx.apiKey.name } : null,
            system,
        };
        if (organizationId) result.organization = await getOrganizationPermissions(ctx.accountId, organizationId);
        return result;
    });

    define("get_monitoring", {
        title: "Get server monitoring data",
        description: "Returns monitoring data (CPU, memory, disk, uptime, processes, OS info) for one server, or the latest snapshot of every monitored server when entryId is omitted.",
        inputSchema: {
            entryId: z.number().int().optional().describe("Entry id of an SSH server with monitoring enabled."),
            timeRange: z.enum(["1h", "6h", "24h"]).optional().describe("History window for the per-server view (default 1h)."),
        },
        annotations: { readOnlyHint: true },
    }, async ({ entryId, timeRange }) => {
        if (entryId) ctx.assertEntryAllowed(entryId);
        const result = entryId
            ? await getServerMonitoring(ctx.accountId, entryId, timeRange || "1h")
            : await getAllServersMonitoring(ctx.accountId);
        if (result?.code) throw new ToolError(result.message, "monitoring_error");
        if (!entryId && ctx.allowedEntryIds) {
            return { ...result, servers: (result.servers || []).filter((s) => ctx.isEntryAllowed(s.id ?? s.entryId)) };
        }
        return result;
    });

    define("list_sessions", {
        title: "List sessions",
        description: "Lists the background (automated) sessions opened by this agent. Set includeInteractive to also see the sessions the account has open in the Nexterm UI (only available to MCP clients).",
        inputSchema: { includeInteractive: z.boolean().optional() },
        annotations: { readOnlyHint: true },
    }, async ({ includeInteractive }) => {
        const sessions = (includeInteractive && !ctx.ownSessionsOnly
            ? SessionManager.getAll(ctx.accountId)
            : SessionManager.getAutomated(ctx.accountId)).filter((s) => ctx.canUseSession(s));
        return { count: sessions.length, sessions: await summarizeSessions(sessions) };
    });
};

module.exports.sessionSummary = sessionSummary;
module.exports.summarizeSessions = summarizeSessions;
