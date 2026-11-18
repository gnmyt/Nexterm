const { z } = require("zod");
const { ToolError, FILE_PROTOCOLS, getEntryProtocol } = require("../context");
const { resolveSftp } = require("./files");
const TransferTickets = require("../TransferTickets");
const Entry = require("../../../models/Entry");
const SessionManager = require("../../SessionManager");
const { mirrorNote } = require("../ActivityMirror");
const { AUDIT_ACTIONS, RESOURCE_TYPES } = require("../../../controllers/audit");
const { Permission } = require("../../../permissions/registry");

const DEFAULT_MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

const isSafeFilePath = (path) => path.startsWith("/") && !path.endsWith("/") && !path.includes("\0") && !path.split("/").includes("..");

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const openFileSession = async (ctx, entryId, connectionReason) => {
    const protocol = getEntryProtocol(await Entry.findByPk(entryId));
    if (protocol && !FILE_PROTOCOLS.has(protocol)) {
        throw new ToolError(`Entry ${entryId} does not support file transfers (protocol: ${protocol})`, "wrong_session_kind");
    }
    const { sessionId } = await ctx.invokeTool("open_session", {
        entryId,
        type: protocol === "ssh" ? "sftp" : undefined,
        connectionReason: connectionReason || "File transfer",
    });
    return sessionId;
};

module.exports = (define, ctx) => {
    if (!ctx.baseUrl) return;

    define("transfer_create", {
        confirm: true,
        title: "Create a file transfer link",
        description: "Creates a single-use HTTPS link to upload a local file to, or download a file from, a remote server. "
            + "Use it for binaries and files too large for file_read / file_write: the bytes go over HTTP (for example with curl from your shell) instead of through tool arguments. "
            + "Pass either an existing SSH/SFTP sessionId or an entryId (a file session is then opened for the transfer and closed afterwards). "
            + "The link carries its own authorization, expires after ttlSeconds and works exactly once. "
            + "Uploads: send the file as the raw request body with PUT (curl -T). Missing parent directories are created when you may modify files. "
            + "Downloads: GET the link. Afterwards transfer_status returns the byte count and sha256 to verify the copy.",
        inputSchema: {
            direction: z.enum(["upload", "download"]),
            path: z.string().min(1).describe("Absolute remote file path to write (upload) or read (download)."),
            sessionId: z.uuid().optional().describe("An open SSH or SFTP session (open_session)."),
            entryId: z.number().int().optional().describe("Entry id to transfer to/from without an open session."),
            ttlSeconds: z.number().int().min(30).max(1800).optional().describe("How long the link stays valid (default 600)."),
            maxBytes: z.number().int().positive().max(10 * DEFAULT_MAX_UPLOAD_BYTES).optional().describe("Upload size limit in bytes (default 1 GiB)."),
            connectionReason: z.string().max(500).optional().describe("Reason for the connection when entryId is used; required by some organizations."),
        },
        annotations: { destructiveHint: true },
    }, async ({ direction, path, sessionId, entryId, ttlSeconds = 600, maxBytes = DEFAULT_MAX_UPLOAD_BYTES, connectionReason }) => {
        if (!sessionId === !entryId) throw new ToolError("Pass either sessionId or entryId", "invalid_arguments");
        if (!isSafeFilePath(path)) throw new ToolError("path must be an absolute file path without '..' segments", "invalid_arguments");

        const isUpload = direction === "upload";
        const ownsSession = !sessionId;
        const transferSessionId = sessionId || await openFileSession(ctx, entryId, connectionReason);

        try {
            const { entry, sftp } = await resolveSftp(ctx, transferSessionId, isUpload ? Permission.FILES_UPLOAD : Permission.FILES_DOWNLOAD);

            let size;
            if (!isUpload) {
                const stats = await sftp.stat(path).catch(() => null);
                if (!stats) throw new ToolError(`${path} does not exist`, "not_found");
                if (stats.isDir) throw new ToolError(`${path} is a directory; only single files can be transferred`, "invalid_arguments");
                size = stats.size;
            }

            const { token, ticket } = TransferTickets.create({
                ctx, sessionId: transferSessionId, ownsSession, entry, path, direction,
                ttlMs: ttlSeconds * 1000, maxBytes: isUpload ? maxBytes : null,
            });

            ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_TRANSFER_CREATE, {
                sessionId: transferSessionId, filePath: path, direction, transferId: ticket.id,
            }, RESOURCE_TYPES.FILE);
            if (!ownsSession) mirrorNote(transferSessionId, `created ${direction} link for ${path}`);

            const url = `${ctx.baseUrl}/api/transfers/${token}`;
            const localFile = shellQuote(`./${path.split("/").pop()}`);
            return {
                transferId: ticket.id,
                url,
                method: isUpload ? "PUT" : "GET",
                expiresAt: ticket.expiresAt.toISOString(),
                ...(isUpload ? { maxBytes } : { size }),
                example: `curl -fsS ${isUpload ? "-T" : "-o"} ${localFile} ${shellQuote(url)}`,
                note: "Single use; treat the link like a password. Call transfer_status afterwards for the byte count and sha256.",
            };
        } catch (err) {
            if (ownsSession) await SessionManager.remove(transferSessionId).catch(() => {});
            throw err;
        }
    });

    define("transfer_status", {
        title: "Get file transfer status",
        description: "Returns the state of a link from transfer_create: pending, in_progress, completed, failed or expired. Completed transfers include the byte count and the sha256 of the transferred data.",
        inputSchema: { transferId: z.uuid() },
        annotations: { readOnlyHint: true },
    }, async ({ transferId }) => {
        const status = TransferTickets.getStatus(transferId, ctx.accountId);
        if (!status) throw new ToolError("Unknown transfer (results are kept for one hour)", "not_found");
        return status;
    });
};
