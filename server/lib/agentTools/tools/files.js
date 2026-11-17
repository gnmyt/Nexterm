const { z } = require("zod");
const { ToolError, FILE_PROTOCOLS } = require("../context");
const { getSFTPAgentClient, createSFTPConnectionForSession } = require("../../ConnectionService");
const SessionManager = require("../../SessionManager");
const { mirrorNote } = require("../ActivityMirror");
const { AUDIT_ACTIONS, RESOURCE_TYPES } = require("../../../controllers/audit");
const { Permission } = require("../../../permissions/registry");

const MAX_READ_BYTES = 512 * 1024;

const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const readEntireFile = (sftp, path, maxBytes) => new Promise((resolve, reject) => {
    const { stream, done } = sftp.readFile(path);
    const chunks = [];
    let size = 0;
    let truncated = false;

    stream.on("data", (chunk) => {
        if (truncated) return;
        size += chunk.length;
        if (size > maxBytes) {
            truncated = true;
            stream.destroy();
            resolve({ truncated: true, buffer: Buffer.concat(chunks) });
            return;
        }
        chunks.push(chunk);
    });
    stream.on("error", reject);
    done.then(() => { if (!truncated) resolve({ truncated: false, buffer: Buffer.concat(chunks) }); }).catch(reject);
});

const resolveSftp = async (ctx, sessionId, permission) => {
    const { session, entry, protocol } = await ctx.resolveSession(sessionId);
    if (!FILE_PROTOCOLS.has(protocol)) {
        throw new ToolError(`Session ${sessionId} does not support file operations (protocol: ${protocol})`, "wrong_session_kind");
    }
    await ctx.requireResourcePermission(entry, permission, `You do not have the ${permission} permission on this server`);
    const isFileSession = session.configuration?.type === "sftp" || protocol !== "ssh";
    if (isFileSession && !SessionManager.getConnection(sessionId)) {
        await createSFTPConnectionForSession(sessionId, entry, ctx.accountId);
    }
    const conn = await ctx.waitForConnection(sessionId);

    const sftp = conn.type === "sftp" && conn.sftpClient
        ? conn.sftpClient
        : await getSFTPAgentClient(sessionId, entry, ctx.accountId);

    return { session, entry, sftp };
};

module.exports = (define, ctx) => {
    define("file_list", {
        title: "List a directory",
        description: "Lists the entries of a directory on the remote server of an SSH or SFTP session.",
        inputSchema: { sessionId: z.uuid(), path: z.string().describe("Absolute directory path.") },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId, path }) => {
        const { sftp } = await resolveSftp(ctx, sessionId, Permission.FILES_VIEW);
        const entries = await sftp.listDir(path);
        mirrorNote(sessionId, `listed ${path} (${entries.length} entries)`);
        return { path, entries };
    });

    define("file_stat", {
        title: "Get file metadata",
        description: "Returns size, mode, owner, group, timestamps and type of a path.",
        inputSchema: { sessionId: z.uuid(), path: z.string() },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId, path }) => {
        const { sftp } = await resolveSftp(ctx, sessionId, Permission.FILES_VIEW);
        return { path, ...(await sftp.stat(path)) };
    });

    define("file_read", {
        title: "Read a file",
        description: "Reads a file from the remote server. Text files are returned as UTF-8 text; set encoding to base64 for binary files. Reads are capped at 512 KB.",
        inputSchema: {
            sessionId: z.uuid(),
            path: z.string(),
            encoding: z.enum(["utf8", "base64"]).optional(),
            maxBytes: z.number().int().positive().max(MAX_READ_BYTES).optional(),
        },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId, path, encoding = "utf8", maxBytes = MAX_READ_BYTES }) => {
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_VIEW);
        const { buffer, truncated } = await readEntireFile(sftp, path, maxBytes);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FILE_READ, { sessionId, filePath: path }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `read ${path} (${formatBytes(buffer.length)}${truncated ? ", truncated" : ""})`);
        return { path, truncated, bytes: buffer.length, encoding, content: buffer.toString(encoding) };
    });

    define("file_write", {
        confirm: true,
        title: "Write a file",
        description: "Creates or overwrites a file on the remote server with the given content (UTF-8 text, or base64 when encoding is set).",
        inputSchema: {
            sessionId: z.uuid(),
            path: z.string(),
            content: z.string(),
            encoding: z.enum(["utf8", "base64"]).optional(),
        },
        annotations: { destructiveHint: true },
    }, async ({ sessionId, path, content, encoding = "utf8" }) => {
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_MODIFY);
        const buffer = Buffer.from(content, encoding);
        await sftp.writeFile(path, buffer);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FILE_WRITE, { sessionId, filePath: path, bytes: buffer.length }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `wrote ${path} (${formatBytes(buffer.length)})`);
        return { path, bytesWritten: buffer.length };
    });

    define("file_edit", {
        confirm: true,
        title: "Edit a text file",
        description: "Replaces an exact snippet inside an existing text file. oldString must match exactly and be unique unless replaceAll is set.",
        inputSchema: {
            sessionId: z.uuid(),
            path: z.string(),
            oldString: z.string(),
            newString: z.string(),
            replaceAll: z.boolean().optional(),
        },
        annotations: { destructiveHint: true },
    }, async ({ sessionId, path, oldString, newString, replaceAll = false }) => {
        if (oldString === newString) throw new ToolError("oldString and newString are identical");
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_MODIFY);
        const { buffer, truncated } = await readEntireFile(sftp, path, MAX_READ_BYTES);
        if (truncated) throw new ToolError("File is too large to edit safely; use run_command instead");
        const content = buffer.toString("utf8");
        const occurrences = content.split(oldString).length - 1;
        if (occurrences === 0) throw new ToolError("oldString was not found in the file");
        if (occurrences > 1 && !replaceAll) throw new ToolError(`oldString is not unique (${occurrences} matches); add context or set replaceAll`);
        const updated = replaceAll
            ? content.split(oldString).join(newString)
            : content.replace(oldString, () => newString);
        await sftp.writeFile(path, Buffer.from(updated, "utf8"));
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FILE_WRITE, { sessionId, filePath: path, replacements: replaceAll ? occurrences : 1 }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `edited ${path} (${replaceAll ? occurrences : 1} replacement${(replaceAll ? occurrences : 1) === 1 ? "" : "s"})`);
        return { path, replacements: replaceAll ? occurrences : 1 };
    });

    define("file_mkdir", {
        confirm: true,
        title: "Create a directory",
        description: "Creates a directory (and parents when recursive is set).",
        inputSchema: { sessionId: z.uuid(), path: z.string(), recursive: z.boolean().optional() },
    }, async ({ sessionId, path, recursive = false }) => {
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_MODIFY);
        if (recursive) await sftp.mkdirRecursive(path);
        else await sftp.mkdir(path);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FOLDER_CREATE, { sessionId, folderPath: path, recursive }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `created directory ${path}`);
        return { path, created: true };
    });

    define("file_delete", {
        confirm: true,
        title: "Delete a file or directory",
        description: "Deletes a file, or a directory (recursively when recursive is set).",
        inputSchema: { sessionId: z.uuid(), path: z.string(), recursive: z.boolean().optional() },
        annotations: { destructiveHint: true },
    }, async ({ sessionId, path, recursive = false }) => {
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_MODIFY);
        const stat = await sftp.stat(path);
        if (stat.isDir) await sftp.rmdir(path, recursive);
        else await sftp.unlink(path);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FILE_DELETE, { sessionId, filePath: path, recursive, directory: stat.isDir }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `deleted ${stat.isDir ? "directory " : ""}${path}`);
        return { path, deleted: true };
    });

    define("file_move", {
        confirm: true,
        title: "Move or rename",
        description: "Moves or renames a file or directory.",
        inputSchema: { sessionId: z.uuid(), source: z.string(), destination: z.string() },
        annotations: { destructiveHint: true },
    }, async ({ sessionId, source, destination }) => {
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_MODIFY);
        await sftp.rename(source, destination);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FILE_RENAME, { sessionId, oldPath: source, newPath: destination }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `moved ${source} → ${destination}`);
        return { source, destination, moved: true };
    });

    define("file_chmod", {
        confirm: true,
        title: "Change permissions",
        description: "Changes the permission mode of a path (octal string such as 644 or 755).",
        inputSchema: { sessionId: z.uuid(), path: z.string(), mode: z.string() },
    }, async ({ sessionId, path, mode }) => {
        const parsed = Number.parseInt(mode, 8);
        if (Number.isNaN(parsed)) throw new ToolError(`Invalid octal mode: ${mode}`);
        const { sftp, entry } = await resolveSftp(ctx, sessionId, Permission.FILES_MODIFY);
        await sftp.chmod(path, parsed);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_FILE_CHMOD, { sessionId, filePath: path, mode }, RESOURCE_TYPES.FILE);
        mirrorNote(sessionId, `chmod ${mode} ${path}`);
        return { path, mode };
    });

    define("file_search_dirs", {
        title: "Search directories",
        description: "Finds directories whose path contains the query.",
        inputSchema: { sessionId: z.uuid(), query: z.string(), maxResults: z.number().int().positive().max(100).optional() },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId, query, maxResults = 20 }) => {
        const { sftp } = await resolveSftp(ctx, sessionId, Permission.FILES_VIEW);
        return { query, directories: await sftp.searchDirs(query, maxResults, 60000) };
    });
};
