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

const escapePath = (p) => `'${p.replaceAll("'", String.raw`'\''`)}'`;

const safeSend = (ws, data) => {
    try { if (ws.readyState === 1) { ws.send(data); return true; } } catch {}
    return false;
};

const sendResult = (ws, op, data) => safeSend(ws, Buffer.concat([Buffer.from([op]), Buffer.from(JSON.stringify(data))]));
const sendAck = (ws, op) => safeSend(ws, Buffer.from([op]));
const sendError = (ws, msg) => sendResult(ws, OP.ERROR, { message: msg });

const auditLog = (user, entry, ipAddress, userAgent, action, resource, details) => {
    createAuditLog({ accountId: user.id, organizationId: entry.organizationId, action, resource, details, ipAddress, userAgent });
}

const buildOperationHandlers = (sftpClient, ws, user, entry, ipAddress, userAgent) => {
    const logAudit = (action, resource, details) => auditLog(user, entry, ipAddress, userAgent, action, resource, details);

    return {
        [OP.LIST_FILES]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            sendResult(ws, OP.LIST_FILES, { files: await sftpClient.listDir(p.path) });
        },
        [OP.CREATE_FILE]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            await sftpClient.writeFile(p.path, Buffer.alloc(0));
            sendAck(ws, OP.CREATE_FILE);
            logAudit(AUDIT_ACTIONS.FILE_CREATE, RESOURCE_TYPES.FILE, { filePath: p.path });
        },
        [OP.CREATE_FOLDER]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            await sftpClient.mkdir(p.path);
            sendAck(ws, OP.CREATE_FOLDER);
            logAudit(AUDIT_ACTIONS.FOLDER_CREATE, RESOURCE_TYPES.FOLDER, { folderPath: p.path });
        },
        [OP.DELETE_FILE]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            await sftpClient.unlink(p.path);
            sendAck(ws, OP.DELETE_FILE);
            logAudit(AUDIT_ACTIONS.FILE_DELETE, RESOURCE_TYPES.FILE, { filePath: p.path });
        },
        [OP.DELETE_FOLDER]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            await sftpClient.rmdir(p.path, true);
            sendAck(ws, OP.DELETE_FOLDER);
            logAudit(AUDIT_ACTIONS.FOLDER_DELETE, RESOURCE_TYPES.FOLDER, { folderPath: p.path });
        },
        [OP.RENAME_FILE]: async (p) => {
            if (!p?.path || !p?.newPath) return sendError(ws, "Invalid paths");
            await sftpClient.rename(p.path, p.newPath);
            sendAck(ws, OP.RENAME_FILE);
            logAudit(AUDIT_ACTIONS.FILE_RENAME, RESOURCE_TYPES.FILE, { oldPath: p.path, newPath: p.newPath });
        },
        [OP.SEARCH_DIRECTORIES]: async (p) => {
            if (!p?.searchPath) return sendError(ws, "Invalid path");
            sendResult(ws, OP.SEARCH_DIRECTORIES, { directories: await sftpClient.searchDirs(p.searchPath) });
        },
        [OP.RESOLVE_SYMLINK]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            sendResult(ws, OP.RESOLVE_SYMLINK, await sftpClient.realpath(p.path));
        },
        [OP.MOVE_FILES]: async (p) => {
            if (!p?.sources?.length || !p?.destination) return sendError(ws, "Invalid paths");
            for (const src of p.sources) {
                await sftpClient.rename(src, `${p.destination}/${src.split("/").pop()}`);
            }
            sendAck(ws, OP.MOVE_FILES);
            logAudit(AUDIT_ACTIONS.FILE_RENAME, RESOURCE_TYPES.FILE, { sources: p.sources, destination: p.destination });
        },
        [OP.COPY_FILES]: async (p) => {
            if (!p?.sources?.length || !p?.destination) return sendError(ws, "Invalid paths");
            const cmds = p.sources.map(src => {
                const dest = p.destination + "/" + src.split("/").pop();
                return "cp -r " + escapePath(src) + " " + escapePath(dest);
            }).join(" && ");
            const result = await sftpClient.exec(cmds);
            if (result.exitCode !== 0) return sendError(ws, result.stderr.trim() || "Failed to copy files");
            sendAck(ws, OP.COPY_FILES);
            logAudit(AUDIT_ACTIONS.FILE_CREATE, RESOURCE_TYPES.FILE, { sources: p.sources, destination: p.destination });
        },
        [OP.CHMOD]: async (p) => {
            if (!p?.path || p?.mode === undefined) return sendError(ws, "Invalid path or mode");
            await sftpClient.chmod(p.path, p.mode);
            sendAck(ws, OP.CHMOD);
            logAudit(AUDIT_ACTIONS.FILE_CHMOD, RESOURCE_TYPES.FILE, { filePath: p.path, mode: p.mode.toString(8) });
        },
        [OP.STAT]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            sendResult(ws, OP.STAT, await sftpClient.stat(p.path));
        },
        [OP.CHECKSUM]: async (p) => {
            if (!p?.path || !p?.algorithm) return sendError(ws, "Invalid path or algorithm");
            const algo = p.algorithm.toLowerCase();
            const cmd = { md5: "md5sum", sha1: "sha1sum", sha256: "sha256sum", sha512: "sha512sum" }[algo];
            if (!cmd) return sendError(ws, "Unsupported algorithm");
            const result = await sftpClient.exec(`${cmd} ${escapePath(p.path)}`);
            if (result.exitCode !== 0) return sendError(ws, result.stderr.trim() || "Checksum failed");
            sendResult(ws, OP.CHECKSUM, { hash: result.stdout.split(/\s+/)[0], algorithm: algo });
        },
        [OP.FOLDER_SIZE]: async (p) => {
            if (!p?.path) return sendError(ws, "Invalid path");
            const result = await sftpClient.exec(`du -sb ${escapePath(p.path)} 2>/dev/null | cut -f1`);
            if (result.exitCode !== 0) return sendError(ws, result.stderr.trim() || "Failed to calculate size");
            sendResult(ws, OP.FOLDER_SIZE, { size: Number.parseInt(result.stdout.trim(), 10) || 0 });
        },
    };
}

module.exports = async (ws, req) => {
    const ctx = await wsAuth(ws, req);
    if (!ctx) return;

    const { entry, user, ipAddress, userAgent, serverSession } = ctx;
    if (serverSession) SessionManager.resume(serverSession.sessionId);

    let isClosing = false;
    const startTime = Date.now();
    const auditLogId = serverSession?.auditLogId || null;
    const sessionId = serverSession?.sessionId;

    const cleanup = async () => {
        if (isClosing) return;
        isClosing = true;
        try { await updateAuditLogWithSessionDuration(auditLogId, startTime); } catch {}
        if (!serverSession) return;

        const conn = SessionManager.getConnection(serverSession.sessionId);
        if (conn?.sftpClient) conn.sftpClient.close();
        if (controlPlane.hasEngine()) {
            try { controlPlane.closeSession(serverSession.sessionId); } catch {}
        }
        if (!serverSession.isHibernated) SessionManager.remove(serverSession.sessionId);
    };

    try {
        let conn = SessionManager.getConnection(sessionId);
        if (!conn?.sftpClient) {
            const entryRecord = await Entry.findByPk(serverSession?.entryId || entry.id);
            await createSFTPConnectionForSession(sessionId, entryRecord, user.id);
            conn = SessionManager.getConnection(sessionId);
        }
        if (!conn?.sftpClient) {
            sendError(ws, "Failed to establish SFTP connection");
            ws.close(4002);
            return;
        }
        const sftpClient = conn.sftpClient;

        ws.on("close", () => cleanup());
        ws.on("error", () => cleanup());
        sftpClient.on("close", () => {
            if (!isClosing) {
                sendError(ws, "SFTP connection lost");
                try { ws.close(4001); } catch {}
            }
        });

        safeSend(ws, Buffer.from([OP.READY]));

        const handlers = buildOperationHandlers(sftpClient, ws, user, entry, ipAddress, userAgent);

        ws.on("message", async (msg) => {
            if (isClosing) return;
            const op = msg[0];
            let payload;
            try { payload = JSON.parse(msg.slice(1).toString()); } catch {}

            const handler = handlers[op];
            if (!handler) return;
            try { await handler(payload); }
            catch (err) { sendError(ws, err.message || "Operation failed"); }
        });
    } catch (err) {
        sendError(ws, "Connection failed: " + err.message);
        await cleanup();
        try {
            ws.close(4005);
        } catch {
        }
    }
};
