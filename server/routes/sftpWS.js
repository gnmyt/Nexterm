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
const logger = require("../utils/logger");

const OP = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11, PATH_SYNC: 0x12,
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
const requireMultiPaths = (p) => { if (!p?.sources?.length || !p?.destination) throw new Error("Invalid paths"); };

const SHELL_LESS_PROTOCOLS = new Set(["ftp", "ftps"]);
const TERMINAL_LESS_PROTOCOLS = new Set(["sftp", "ftp", "ftps"]);

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
        sendResult(ws, OP.LIST_FILES, { files: await sftp.listDir(p.path) });
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
        sendResult(ws, OP.RESOLVE_SYMLINK, await sftp.realpath(p.path));
    },
    [OP.MOVE_FILES]: async (p) => {
        requireMultiPaths(p);
        for (const src of p.sources) {
            await sftp.rename(src, `${p.destination}/${src.split("/").pop()}`);
        }
        sendAck(ws, OP.MOVE_FILES);
        logAudit(AUDIT_ACTIONS.FILE_RENAME, RESOURCE_TYPES.FILE, { sources: p.sources, destination: p.destination });
    },
    [OP.COPY_FILES]: async (p) => {
        requireMultiPaths(p);
        requireShell(capabilities);
        const cmds = p.sources.map((src) => {
            const dest = `${p.destination}/${src.split("/").pop()}`;
            return `cp -r ${escapePath(src)} ${escapePath(dest)}`;
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

    if (serverSession) SessionManager.resume(serverSession.sessionId);

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

        SessionManager.addWebSocket(sessionId, ws, false, buildParticipant(ctx));

        const onSftpClose = () => {
            sendError(ws, "SFTP connection lost");
            try { ws.close(4001); } catch {}
        };
        sftpClient.on("close", onSftpClose);

        const capabilities = getCapabilities(entry);
        const storedPath = SessionManager.getSftpPath(sessionId);
        sendResult(ws, OP.READY, { path: storedPath, capabilities });

        const logAudit = (action, resource, details) => {
            createAuditLog({ accountId: user.id, organizationId: entry.organizationId, action, resource, details, ipAddress, userAgent });
        };
        const handlers = buildOperationHandlers(sftpClient, getBg, ws, logAudit, capabilities);

        const messageHandler = async (msg) => {
            const opCode = msg[0];

            if (opCode === OP.PATH_SYNC) {
                let payload;
                try { payload = JSON.parse(msg.slice(1).toString()); } catch {}
                if (payload?.path) {
                    SessionManager.setSftpPath(sessionId, payload.path);
                    const session = SessionManager.get(sessionId);
                    if (session) {
                        for (const other of session.connectedWs) {
                            if (other !== ws && other.readyState === 1) {
                                sendResult(other, OP.PATH_SYNC, { path: payload.path });
                            }
                        }
                    }
                }
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
