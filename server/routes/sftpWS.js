const wsAuth = require("../middlewares/wsAuth");
const {
    createAuditLog,
    AUDIT_ACTIONS,
    RESOURCE_TYPES,
    updateAuditLogWithSessionDuration,
} = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const { buildParticipant } = require("../utils/sessionParticipant");
const { createSFTPConnectionForSession, getSFTPBackgroundClient } = require("../lib/ConnectionService");
const { hasResourcePermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const Entry = require("../models/Entry");
const TransferRegistry = require("../lib/TransferRegistry");
const logger = require("../utils/logger");

const OP = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11, PATH_SYNC: 0x12,
    TRANSFER_PROGRESS: TransferRegistry.OP_TRANSFER_PROGRESS, CANCEL_TRANSFER: 0x14, CHECK_EXISTS: 0x15,
};

const CHECKSUM_COMMANDS = { md5: "md5sum", sha1: "sha1sum", sha256: "sha256sum", sha512: "sha512sum" };

const MUTATING_OPS = new Set([
    OP.CREATE_FILE, OP.CREATE_FOLDER, OP.DELETE_FILE, OP.DELETE_FOLDER,
    OP.RENAME_FILE, OP.MOVE_FILES, OP.COPY_FILES, OP.CHMOD,
]);

const escapePath = (p) => `'${p.replaceAll("'", String.raw`'\''`)}'`;

const safeSend = (ws, data) => {
    if (ws.readyState !== 1) return false;
    try { ws.send(data); return true; } catch { return false; }
};

const sendResult = (ws, op, data) => safeSend(ws, Buffer.concat([Buffer.from([op]), Buffer.from(JSON.stringify(data))]));
const sendAck = (ws, op) => safeSend(ws, Buffer.from([op]));
const sendError = (ws, msg) => sendResult(ws, OP.ERROR, { message: msg });

const requirePath = (p) => { if (!p?.path) throw new Error("Invalid path"); };
const requirePaths = (p) => { if (!p?.path || !p?.newPath) throw new Error("Invalid paths"); };
const normalizePath = (p) => p.replace(/\/+/g, "/").replace(/(.)\/$/, "$1");
const destinationFor = (destination, src) => normalizePath(`${destination}/${normalizePath(src).split("/").pop()}`);
const requireMultiPaths = (p) => {
    if (!p?.sources?.length || !p?.destination) throw new Error("Invalid paths");
    if (p.sources.some((src) => normalizePath(src) === destinationFor(p.destination, src))) throw new Error("Source and destination are the same");
};
const SFTP_PATH_RESOLUTION_TIMEOUT_MS = 5000;
const resolveDirectory = (sftp, path) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SFTP path resolution timed out")), SFTP_PATH_RESOLUTION_TIMEOUT_MS);
    Promise.resolve().then(() => sftp.realpath(path)).then(
        (result) => { clearTimeout(timeout); resolve(result); },
        (err) => { clearTimeout(timeout); reject(err); },
    );
});

// Paths synced by clients must be absolute; if a client ever sends a relative
// path (e.g. a session whose stored path predates root anchoring), resolve it
// against the session root so directory navigation never regresses.
const WINDOWS_ABSOLUTE = /^[a-z]:[\\/]/i;
const anchorToRoot = (path, rootPath) => {
    if (!path || path.startsWith("/") || WINDOWS_ABSOLUTE.test(path)) return path;
    const root = rootPath && rootPath !== "/" ? rootPath.replace(/\/+$/, "") : "";
    return `${root}/${path}`;
};

const SHELL_LESS_PROTOCOLS = new Set(["ftp", "ftps"]);
const TERMINAL_LESS_PROTOCOLS = new Set(["sftp", "ftp", "ftps"]);

const isSftpEntry = (entry) => ["sftp", "ssh"].includes(
    entry.type === "server" ? entry.config?.protocol : entry.type
);

const getCapabilities = (entry) => {
    const protocol = entry.type === "server" ? entry.config?.protocol : entry.type;
    return {
        shell: !SHELL_LESS_PROTOCOLS.has(protocol),
        terminal: !TERMINAL_LESS_PROTOCOLS.has(protocol),
    };
};

const requireShell = (capabilities) => {
    if (!capabilities.shell) throw new Error("This operation is not supported over FTP");
};

const buildOperationHandlers = (sftp, getBg, ws, logAudit, capabilities) => ({
    [OP.LIST_FILES]: async (p) => {
        requirePath(p);
        sendResult(ws, OP.LIST_FILES, { path: p.path, files: await sftp.listDir(p.path) });
    },
    [OP.CREATE_FILE]: async (p) => {
        requirePath(p);
        await sftp.writeFile(p.path, Buffer.alloc(0));
        sendAck(ws, OP.CREATE_FILE);
        logAudit(AUDIT_ACTIONS.FILE_CREATE, RESOURCE_TYPES.FILE, { filePath: p.path });
    },
    [OP.CREATE_FOLDER]: async (p) => {
        requirePath(p);
        if (p.recursive) await sftp.mkdirRecursive(p.path);
        else await sftp.mkdir(p.path);
        sendAck(ws, OP.CREATE_FOLDER);
        logAudit(AUDIT_ACTIONS.FOLDER_CREATE, RESOURCE_TYPES.FOLDER, { folderPath: p.path });
    },
    [OP.DELETE_FILE]: async (p) => {
        requirePath(p);
        await sftp.unlink(p.path);
        sendAck(ws, OP.DELETE_FILE);
        logAudit(AUDIT_ACTIONS.FILE_DELETE, RESOURCE_TYPES.FILE, { filePath: p.path });
    },
    [OP.DELETE_FOLDER]: async (p) => {
        requirePath(p);
        await sftp.rmdir(p.path, true);
        sendAck(ws, OP.DELETE_FOLDER);
        logAudit(AUDIT_ACTIONS.FOLDER_DELETE, RESOURCE_TYPES.FOLDER, { folderPath: p.path });
    },
    [OP.RENAME_FILE]: async (p) => {
        requirePaths(p);
        await sftp.rename(p.path, p.newPath);
        sendAck(ws, OP.RENAME_FILE);
        logAudit(AUDIT_ACTIONS.FILE_RENAME, RESOURCE_TYPES.FILE, { oldPath: p.path, newPath: p.newPath });
    },
    [OP.SEARCH_DIRECTORIES]: async (p) => {
        if (!p?.searchPath) throw new Error("Invalid path");
        sendResult(ws, OP.SEARCH_DIRECTORIES, { directories: await sftp.searchDirs(p.searchPath) });
    },
    [OP.RESOLVE_SYMLINK]: async (p) => {
        requirePath(p);
        const resolved = await sftp.realpath(p.path);
        const size = resolved.isDirectory ? 0 : (await sftp.stat(resolved.path)).size;
        sendResult(ws, OP.RESOLVE_SYMLINK, { ...resolved, size });
    },
    [OP.CHECK_EXISTS]: async (p) => {
        const paths = Array.isArray(p?.paths) ? p.paths.filter((path) => typeof path === "string") : [];
        const byDirectory = new Map();
        for (const path of paths) {
            const normalized = normalizePath(path);
            const cut = normalized.lastIndexOf("/");
            const directory = cut < 0 ? "." : normalized.slice(0, cut) || "/";
            if (!byDirectory.has(directory)) byDirectory.set(directory, []);
            byDirectory.get(directory).push({ path, name: normalized.slice(cut + 1) });
        }
        const existing = [];
        for (const [directory, entries] of byDirectory) {
            if (entries.length === 1) {
                if (await sftp.stat(entries[0].path).catch(() => null)) existing.push(entries[0].path);
                continue;
            }
            const listing = await sftp.listDir(directory).catch(() => []);
            const names = new Set(listing.map((entry) => entry.name));
            for (const entry of entries) {
                if (names.has(entry.name)) existing.push(entry.path);
            }
        }
        sendResult(ws, OP.CHECK_EXISTS, { id: p?.id, existing });
    },
    [OP.MOVE_FILES]: async (p) => {
        requireMultiPaths(p);
        for (const src of p.sources) {
            const dest = destinationFor(p.destination, src);
            const replaced = p.overwrite ? await sftp.stat(dest).catch(() => null) : null;
            if (!replaced) {
                await sftp.rename(src, dest);
                continue;
            }
            const backup = `${dest}.nexterm-replaced-${Date.now()}`;
            await sftp.rename(dest, backup);
            try {
                await sftp.rename(src, dest);
            } catch (err) {
                await sftp.rename(backup, dest).catch(() => {});
                throw err;
            }
            if (replaced.isDir) await sftp.rmdir(backup, true);
            else await sftp.unlink(backup);
        }
        sendAck(ws, OP.MOVE_FILES);
        logAudit(AUDIT_ACTIONS.FILE_RENAME, RESOURCE_TYPES.FILE, { sources: p.sources, destination: p.destination });
    },
    [OP.COPY_FILES]: async (p) => {
        requireMultiPaths(p);
        requireShell(capabilities);
        const cmds = p.sources.map((src) => {
            const dest = destinationFor(p.destination, src);
            const copy = `cp -r ${escapePath(src)} ${escapePath(dest)}`;
            return p.overwrite ? `rm -rf ${escapePath(dest)} && ${copy}` : copy;
        }).join(" && ");
        const bg = await getBg();
        const result = await bg.exec(cmds);
        if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Failed to copy files");
        sendAck(ws, OP.COPY_FILES);
        logAudit(AUDIT_ACTIONS.FILE_CREATE, RESOURCE_TYPES.FILE, { sources: p.sources, destination: p.destination });
    },
    [OP.CHMOD]: async (p) => {
        if (!p?.path || p?.mode === undefined) throw new Error("Invalid path or mode");
        await sftp.chmod(p.path, p.mode);
        sendAck(ws, OP.CHMOD);
        logAudit(AUDIT_ACTIONS.FILE_CHMOD, RESOURCE_TYPES.FILE, { filePath: p.path, mode: p.mode.toString(8) });
    },
    [OP.STAT]: async (p) => {
        requirePath(p);
        sendResult(ws, OP.STAT, await sftp.stat(p.path));
    },
    [OP.CHECKSUM]: async (p) => {
        if (!p?.path || !p?.algorithm) throw new Error("Invalid path or algorithm");
        requireShell(capabilities);
        const algo = p.algorithm.toLowerCase();
        const cmd = CHECKSUM_COMMANDS[algo];
        if (!cmd) throw new Error("Unsupported algorithm");
        const bg = await getBg();
        const result = await bg.exec(`${cmd} ${escapePath(p.path)}`);
        if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Checksum failed");
        sendResult(ws, OP.CHECKSUM, { hash: result.stdout.split(/\s+/)[0], algorithm: algo });
    },
    [OP.FOLDER_SIZE]: async (p) => {
        requirePath(p);
        requireShell(capabilities);
        const bg = await getBg();
        const result = await bg.exec(`du -sb ${escapePath(p.path)} 2>/dev/null | cut -f1`);
        if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Failed to calculate size");
        sendResult(ws, OP.FOLDER_SIZE, { size: Number.parseInt(result.stdout.trim(), 10) || 0 });
    },
});

const resolveSftpClient = async (sessionId, entryId, userId) => {
    let conn = SessionManager.getConnection(sessionId);
    if (!conn?.sftpClient) {
        const entry = await Entry.findByPk(entryId);
        await createSFTPConnectionForSession(sessionId, entry, userId);
        conn = SessionManager.getConnection(sessionId);
    }
    return conn?.sftpClient ?? null;
};

module.exports = async (ws, req) => {
    const ctx = await wsAuth(ws, req);
    if (!ctx) return;

    const { entry, user, ipAddress, userAgent, serverSession } = ctx;

    const [canView, canModify] = await Promise.all([
        hasResourcePermission(user.id, entry.organizationId, Permission.FILES_VIEW),
        hasResourcePermission(user.id, entry.organizationId, Permission.FILES_MODIFY),
    ]);
    if (!canView) {
        sendError(ws, "You don't have permission to browse files on this server");
        ws.close(4403);
        return;
    }

    if (serverSession) {
        SessionManager.resume(serverSession.sessionId, null, null, ctx.session?.id || null, {
            touchLoginSession: !ctx.isShared,
        });
    }

    const sessionId = serverSession?.sessionId;
    const auditLogId = serverSession?.auditLogId ?? null;
    const startTime = Date.now();

    try {
        const entryId = serverSession?.entryId ?? entry.id;
        const sftpClient = await resolveSftpClient(sessionId, entryId, user.id);
        if (!sftpClient) {
            sendError(ws, "Failed to establish SFTP connection");
            ws.close(4002);
            return;
        }

        const getBg = async () => {
            const fullEntry = await Entry.findByPk(entryId);
            try {
                return await getSFTPBackgroundClient(sessionId, fullEntry, user.id);
            } catch (err) {
                logger.warn("Falling back to metadata SFTP client for background op", { sessionId, error: err.message });
                return sftpClient;
            }
        };

        ws.isSftp = true;
        SessionManager.addWebSocket(sessionId, ws, false, buildParticipant(ctx));

        const onSftpClose = () => {
            sendError(ws, "SFTP connection lost");
            try { ws.close(4001); } catch {}
        };
        sftpClient.on("close", onSftpClose);

        const capabilities = getCapabilities(entry);
        let storedPath = SessionManager.getSftpPath(sessionId);
        let rootPath = "/";
        const [resolvedRoot, resolvedHome] = await Promise.all([
            isSftpEntry(entry) ? resolveDirectory(sftpClient, "/").catch((err) => {
                logger.debug("Failed to resolve SFTP root; using slash", { sessionId, error: err.message });
                return null;
            }) : null,
            resolveDirectory(sftpClient, ".").catch((err) => {
                logger.debug("Failed to resolve SFTP home; using root", { sessionId, error: err.message });
                return null;
            }),
        ]);
        if (resolvedRoot?.path && resolvedRoot.isDirectory) rootPath = resolvedRoot.path;
        const home = resolvedHome?.path && resolvedHome.isDirectory ? resolvedHome.path : null;

        if (isSftpEntry(entry)) {
            if (!storedPath) storedPath = home || rootPath;
            storedPath = anchorToRoot(storedPath, rootPath) || rootPath;
            SessionManager.setSftpPath(sessionId, storedPath);
        } else {
            storedPath ||= rootPath;
        }
        sendResult(ws, OP.READY, { path: storedPath, rootPath, home, capabilities, transfers: TransferRegistry.list(sessionId) });

        const logAudit = (action, resource, details) => {
            createAuditLog({ accountId: user.id, organizationId: entry.organizationId, action, resource, details, ipAddress, userAgent });
        };
        const handlers = buildOperationHandlers(sftpClient, getBg, ws, logAudit, capabilities);

        const messageHandler = async (msg) => {
            const opCode = msg[0];

            if (sessionId) SessionManager.updateActivity(sessionId, { touchLoginSession: !ctx.isShared });

            if (opCode === OP.PATH_SYNC) {
                let payload;
                try { payload = JSON.parse(msg.slice(1).toString()); } catch {}
                if (payload?.path) {
                    const syncedPath = anchorToRoot(payload.path, rootPath);
                    SessionManager.setSftpPath(sessionId, syncedPath);
                    const session = SessionManager.get(sessionId);
                    if (session) {
                        for (const other of session.connectedWs) {
                            if (other !== ws && other.readyState === 1) {
                                sendResult(other, OP.PATH_SYNC, { path: syncedPath });
                            }
                        }
                    }
                }
                return;
            }

            if (opCode === OP.CANCEL_TRANSFER) {
                let payload;
                try { payload = JSON.parse(msg.slice(1).toString()); } catch {}
                if (TransferRegistry.isValidTransferId(payload?.id)) TransferRegistry.cancel(payload.id, sessionId);
                return;
            }

            const handler = handlers[opCode];
            if (!handler) return;
            if (MUTATING_OPS.has(opCode) && !canModify) {
                sendError(ws, "You don't have permission to modify files on this server");
                return;
            }
            let payload;
            try { payload = JSON.parse(msg.slice(1).toString()); } catch {}
            try { await handler(payload); }
            catch (err) { sendError(ws, err.message || "Operation failed"); }
        };

        ws.on("message", messageHandler);

        ws.on("close", async () => {
            sftpClient.removeListener("close", onSftpClose);
            ws.removeListener("message", messageHandler);
            SessionManager.removeWebSocket(sessionId, ws);
            try { await updateAuditLogWithSessionDuration(auditLogId, startTime); } catch {}
        });
    } catch (err) {
        sendError(ws, "Connection failed: " + err.message);
        try { ws.close(4005); } catch {}
    }
};
