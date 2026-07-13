const { z } = require("zod");
const { AUDIT_ACTIONS, RESOURCE_TYPES } = require("../../controllers/audit");

const MAX_OUTPUT_CHARS = 20000;
const MAX_FILE_BYTES = 256 * 1024;

const truncate = (text) => {
    if (typeof text !== "string") return text;
    if (text.length <= MAX_OUTPUT_CHARS) return text;
    return `${text.slice(0, MAX_OUTPUT_CHARS)}\n… [truncated ${text.length - MAX_OUTPUT_CHARS} characters]`;
};

class AbortError extends Error {
    constructor() {
        super("Aborted");
        this.name = "AbortError";
    }
}

const throwIfAborted = (signal) => {
    if (signal?.aborted) throw new AbortError();
};

const abortable = (promise, signal) => {
    if (!signal) return promise;
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(new AbortError());
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(
            (value) => {
                signal.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener("abort", onAbort);
                reject(error);
            },
        );
    });
};

const readEntireFile = (sftp, path) => new Promise((resolve, reject) => {
    const { stream, done } = sftp.readFile(path);
    const chunks = [];
    let size = 0;
    let aborted = false;

    stream.on("data", (chunk) => {
        if (aborted) return;
        size += chunk.length;
        if (size > MAX_FILE_BYTES) {
            aborted = true;
            stream.destroy();
            resolve({ truncated: true, content: Buffer.concat(chunks).toString("utf8") });
            return;
        }
        chunks.push(chunk);
    });
    stream.on("error", reject);
    done.then(() => {
        if (!aborted) resolve({ truncated: false, content: Buffer.concat(chunks).toString("utf8") });
    }).catch(reject);
});

const buildTools = ({ sftp, canModify, requireConfirmation, requestApproval, logAudit, tool }) => {
    const define = (name, description, inputSchema, runner, { mutating = false, audit } = {}) => tool({
        description,
        inputSchema,
        execute: async (input, { toolCallId, abortSignal }) => {
            throwIfAborted(abortSignal);
            if (mutating && !canModify) {
                return { denied: true, message: "You do not have permission to modify files on this server." };
            }
            if (requireConfirmation) {
                const allowed = await requestApproval(name, input, toolCallId);
                if (!allowed) return { denied: true, message: "The user denied this action." };
            }
            throwIfAborted(abortSignal);
            const result = await abortable(runner(input, abortSignal), abortSignal);
            if (audit && logAudit) {
                const { action, details } = audit(input);
                logAudit(action, RESOURCE_TYPES.FILE, details);
            }
            return result;
        },
    });

    return {
        runCommand: define(
            "runCommand",
            "Run a non-interactive shell command on the server and capture stdout, stderr and the exit code.",
            z.object({
                command: z.string().describe("The shell command to execute."),
                timeoutSeconds: z.number().int().positive().max(1800).optional()
                    .describe("Seconds to wait for the command to finish before timing out. Increase for long-running commands like installs, builds or backups. Defaults to 300 (max 1800)."),
            }),
            async ({ command, timeoutSeconds }) => {
                const { stdout, stderr, exitCode } = await sftp.exec(command, (timeoutSeconds || 300) * 1000);
                return { exitCode, stdout: truncate(stdout), stderr: truncate(stderr) };
            },
            { mutating: true, audit: ({ command }) => ({ action: AUDIT_ACTIONS.AI_COMMAND, details: { command } }) },
        ),

        readFile: define(
            "readFile",
            "Read the contents of a text file on the server.",
            z.object({ path: z.string().describe("Absolute path to the file.") }),
            async ({ path }) => {
                const { content, truncated } = await readEntireFile(sftp, path);
                return { path, truncated, content };
            },
        ),

        writeFile: define(
            "writeFile",
            "Create or overwrite a file on the server with the given contents.",
            z.object({
                path: z.string().describe("Absolute path to the file."),
                content: z.string().describe("The full new contents of the file."),
            }),
            async ({ path, content }) => {
                await sftp.writeFile(path, Buffer.from(content, "utf8"));
                return { path, bytesWritten: Buffer.byteLength(content, "utf8") };
            },
            {
                mutating: true,
                audit: ({ path }) => ({ action: AUDIT_ACTIONS.AI_FILE_WRITE, details: { filePath: path } }),
            },
        ),

        editFile: define(
            "editFile",
            "Make a precise edit to an existing text file by replacing an exact snippet with new text. Prefer this over writeFile when changing part of a file — it avoids rewriting the whole file. oldString must match the file exactly (including whitespace and indentation) and be unique, unless replaceAll is set.",
            z.object({
                path: z.string().describe("Absolute path to the file."),
                oldString: z.string().describe("The exact text to replace, matching the file byte-for-byte including indentation."),
                newString: z.string().describe("The text to replace it with."),
                replaceAll: z.boolean().optional().describe("Replace every occurrence instead of requiring a single unique match."),
            }),
            async ({ path, oldString, newString, replaceAll }) => {
                if (oldString === newString) throw new Error("oldString and newString are identical.");
                const { content, truncated } = await readEntireFile(sftp, path);
                if (truncated) throw new Error("File is too large to edit safely; use runCommand for large files.");
                const occurrences = content.split(oldString).length - 1;
                if (occurrences === 0) throw new Error("oldString was not found in the file.");
                if (occurrences > 1 && !replaceAll) {
                    throw new Error(`oldString is not unique (${occurrences} matches); add surrounding context or set replaceAll.`);
                }
                let updated;
                if (replaceAll) {
                    updated = content.split(oldString).join(newString);
                } else {
                    const idx = content.indexOf(oldString);
                    updated = content.slice(0, idx) + newString + content.slice(idx + oldString.length);
                }
                await sftp.writeFile(path, Buffer.from(updated, "utf8"));
                return { path, replacements: replaceAll ? occurrences : 1 };
            },
            {
                mutating: true,
                audit: ({ path }) => ({ action: AUDIT_ACTIONS.AI_FILE_WRITE, details: { filePath: path } }),
            },
        ),

        listDirectory: define(
            "listDirectory",
            "List the entries of a directory on the server.",
            z.object({ path: z.string().describe("Absolute path to the directory.") }),
            async ({ path }) => {
                const entries = await sftp.listDir(path);
                return { path, entries };
            },
        ),

        statPath: define(
            "statPath",
            "Get metadata (size, permissions, owner, type) for a file or directory.",
            z.object({ path: z.string().describe("Absolute path to inspect.") }),
            async ({ path }) => ({ path, ...(await sftp.stat(path)) }),
        ),

        makeDirectory: define(
            "makeDirectory",
            "Create a new directory on the server.",
            z.object({ path: z.string().describe("Absolute path of the directory to create.") }),
            async ({ path }) => {
                await sftp.mkdir(path);
                return { path, created: true };
            },
            {
                mutating: true,
                audit: ({ path }) => ({ action: AUDIT_ACTIONS.AI_FOLDER_CREATE, details: { folderPath: path } }),
            },
        ),

        deleteFile: define(
            "deleteFile",
            "Delete a single file on the server.",
            z.object({ path: z.string().describe("Absolute path of the file to delete.") }),
            async ({ path }) => {
                await sftp.unlink(path);
                return { path, deleted: true };
            },
            {
                mutating: true,
                audit: ({ path }) => ({ action: AUDIT_ACTIONS.AI_FILE_DELETE, details: { filePath: path } }),
            },
        ),

        removeDirectory: define(
            "removeDirectory",
            "Remove a directory on the server, optionally including its contents.",
            z.object({
                path: z.string().describe("Absolute path of the directory to remove."),
                recursive: z.boolean().optional().describe("Remove all contents recursively."),
            }),
            async ({ path, recursive }) => {
                await sftp.rmdir(path, Boolean(recursive));
                return { path, removed: true, recursive: Boolean(recursive) };
            },
            {
                mutating: true,
                audit: ({ path, recursive }) => ({
                    action: AUDIT_ACTIONS.AI_FILE_DELETE,
                    details: { folderPath: path, recursive: Boolean(recursive) },
                }),
            },
        ),

        movePath: define(
            "movePath",
            "Move or rename a file or directory on the server.",
            z.object({
                source: z.string().describe("Current absolute path."),
                destination: z.string().describe("New absolute path."),
            }),
            async ({ source, destination }) => {
                await sftp.rename(source, destination);
                return { source, destination, moved: true };
            },
            {
                mutating: true,
                audit: ({ source, destination }) => ({
                    action: AUDIT_ACTIONS.AI_FILE_RENAME,
                    details: { oldPath: source, newPath: destination },
                }),
            },
        ),

        changePermissions: define(
            "changePermissions",
            "Change the permission mode of a file or directory.",
            z.object({
                path: z.string().describe("Absolute path to modify."),
                mode: z.string().describe("Octal permission mode, e.g. \"644\" or \"755\"."),
            }),
            async ({ path, mode }) => {
                const parsed = parseInt(mode, 8);
                if (Number.isNaN(parsed)) throw new Error(`Invalid octal mode: ${mode}`);
                await sftp.chmod(path, parsed);
                return { path, mode };
            },
            {
                mutating: true,
                audit: ({ path, mode }) => ({ action: AUDIT_ACTIONS.AI_FILE_CHMOD, details: { filePath: path, mode } }),
            },
        ),

        findDirectories: define(
            "findDirectories",
            "Search for directories on the server whose path matches a query.",
            z.object({
                query: z.string().describe("Partial path or name to search for."),
                maxResults: z.number().int().positive().max(100).optional().describe("Maximum results to return."),
            }),
            async ({ query, maxResults }) => ({ query, directories: await sftp.searchDirs(query, maxResults || 20) }),
        ),
    };
};

module.exports = { buildTools };
