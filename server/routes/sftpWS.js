const wsAuth = require("../middlewares/wsAuth");
const {
    createAuditLog,
    AUDIT_ACTIONS,
    RESOURCE_TYPES,
    updateAuditLogWithSessionDuration,
} = require("../controllers/audit");
const SessionManager = require("../lib/SessionManager");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { createSFTPConnectionForSession } = require("../lib/ConnectionService");
const Entry = require("../models/Entry");

const OP = {
    READY: 0x0, LIST_FILES: 0x1, CREATE_FILE: 0x4, CREATE_FOLDER: 0x5, DELETE_FILE: 0x6,
    DELETE_FOLDER: 0x7, RENAME_FILE: 0x8, ERROR: 0x9, SEARCH_DIRECTORIES: 0xA,
    RESOLVE_SYMLINK: 0xB, MOVE_FILES: 0xC, COPY_FILES: 0xD, CHMOD: 0xE,
    STAT: 0xF, CHECKSUM: 0x10, FOLDER_SIZE: 0x11,
};

const CHECKSUM_COMMANDS = { md5: "md5sum", sha1: "sha1sum", sha256: "sha256sum", sha512: "sha512sum" };

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

const buildOperationHandlers = (sftp, ws, logAudit) => ({
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
        await sftp.mkdir(p.path);
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
        const cmds = p.sources.map((src) => {
            const dest = `${p.destination}/${src.split("/").pop()}`;
            return `cp -r ${escapePath(src)} ${escapePath(dest)}`;
        }).join(" && ");
        const result = await sftp.exec(cmds);
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
        const algo = p.algorithm.toLowerCase();
        const cmd = CHECKSUM_COMMANDS[algo];
        if (!cmd) throw new Error("Unsupported algorithm");
        const result = await sftp.exec(`${cmd} ${escapePath(p.path)}`);
        if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Checksum failed");
        sendResult(ws, OP.CHECKSUM, { hash: result.stdout.split(/\s+/)[0], algorithm: algo });
    },
    [OP.FOLDER_SIZE]: async (p) => {
        requirePath(p);
        const result = await sftp.exec(`du -sb ${escapePath(p.path)} 2>/dev/null | cut -f1`);
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
    if (serverSession) SessionManager.resume(serverSession.sessionId);

    const sessionId = serverSession?.sessionId;
    const auditLogId = serverSession?.auditLogId ?? null;
    const startTime = Date.now();
    let isClosing = false;

    const cleanup = async () => {
        if (isClosing) return;
        isClosing = true;
        try { await updateAuditLogWithSessionDuration(auditLogId, startTime); } catch {}
        if (!serverSession) return;

        const conn = SessionManager.getConnection(sessionId);
        if (conn?.sftpClient) conn.sftpClient.close();
        if (controlPlane.hasEngine()) {
            try { controlPlane.closeSession(sessionId); } catch {}
        }
        if (!serverSession.isHibernated) SessionManager.remove(sessionId);
    };

    try {
        const sftpClient = await resolveSftpClient(sessionId, serverSession?.entryId ?? entry.id, user.id);
        if (!sftpClient) {
            sendError(ws, "Failed to establish SFTP connection");
            ws.close(4002);
            return;
        }

        ws.on("close", () => cleanup());
        ws.on("error", () => cleanup());
        sftpClient.on("close", () => {
            if (!isClosing) {
                sendError(ws, "SFTP connection lost");
                try { ws.close(4001); } catch {}
            }
        });

        safeSend(ws, Buffer.from([OP.READY]));

        const logAudit = (action, resource, details) => {
            createAuditLog({ accountId: user.id, organizationId: entry.organizationId, action, resource, details, ipAddress, userAgent });
        };
        const handlers = buildOperationHandlers(sftpClient, ws, logAudit);

        ws.on("message", async (msg) => {
            if (isClosing) return;
            const handler = handlers[msg[0]];
            if (!handler) return;
            let payload;
            try { payload = JSON.parse(msg.slice(1).toString()); } catch {}
            try { await handler(payload); }
            catch (err) { sendError(ws, err.message || "Operation failed"); }
        });
    } catch (err) {
        sendError(ws, "Connection failed: " + err.message);
        await cleanup();
        try { ws.close(4005); } catch {}
    }
};
