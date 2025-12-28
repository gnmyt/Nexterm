const wsAuth = require("../middlewares/wsAuth");
const {
    createAuditLog,
    AUDIT_ACTIONS,
    RESOURCE_TYPES,
    updateAuditLogWithSessionDuration,
} = require("../controllers/audit");
const { deleteFolderRecursive, searchDirectories, OPERATIONS } = require("../utils/sftpHelpers");
const { createSSHConnection } = require("../utils/sshConnection");
const SessionManager = require("../lib/SessionManager");

const safeSend = (ws, data) => {
    try {
        if (ws.readyState === 1) {
            ws.send(data);
            return true;
        }
    } catch {
    }
    return false;
};
const sendError = (ws, msg) => safeSend(ws, Buffer.concat([Buffer.from([OPERATIONS.ERROR]), Buffer.from(JSON.stringify({ message: msg }))]));
const getErrMsg = (err, def) => ({
    2: "Path does not exist",
    3: "Permission denied",
    4: "Already exists",
}[err?.code] || err?.message || def);

module.exports = async (ws, req) => {
    const ctx = await wsAuth(ws, req);
    if (!ctx) return;

    const { entry, identity, user, connectionReason, ipAddress, userAgent, serverSession } = ctx;
    if (serverSession) SessionManager.resume(serverSession.sessionId);

    let ssh = null, sftp = null, isClosing = false;
    const startTime = Date.now();
    const auditLogId = serverSession?.auditLogId || null;

    const cleanup = async () => {
        if (isClosing) return;
        isClosing = true;
        try {
            await updateAuditLogWithSessionDuration(auditLogId, startTime);
        } catch {
        }
        if (serverSession) {
            const s = SessionManager.get(serverSession.sessionId);
            if (s && !s.isHibernated) SessionManager.remove(serverSession.sessionId);
        }
        try {
            ssh?._jumpConnections?.forEach(c => {
                try {
                    c.ssh.end();
                } catch {
                }
            });
            ssh?.end();
        } catch {
        }
    };

    try {
        ssh = await createSSHConnection(entry, identity, ws, user.id);
        ssh.on("error", async (err) => {
            sendError(ws, "Connection error: " + err.message);
            await cleanup("ssh_error");
            try {
                ws.close(4001);
            } catch {
            }
        });
        ssh.on("end", () => cleanup("ssh_end"));
        ws.on("close", () => cleanup("ws_close"));
        ws.on("error", () => cleanup("ws_error"));

        ssh.on("ready", () => {
            ssh.sftp((err, sftpSession) => {
                if (err) {
                    sendError(ws, "SFTP failed: " + err.message);
                    ws.close(4002);
                    return;
                }
                sftp = sftpSession;
                if (serverSession) SessionManager.setConnection(serverSession.sessionId, { ssh, sftp, auditLogId });
                safeSend(ws, Buffer.from([OPERATIONS.READY]));

                ws.on("message", async (msg) => {
                    if (isClosing) return;
                    const op = msg[0];
                    let payload;
                    try {
                        payload = JSON.parse(msg.slice(1).toString());
                    } catch {
                    }

                    try {
                        switch (op) {
                            case OPERATIONS.LIST_FILES:
                                if (!payload?.path) return sendError(ws, "Invalid path");
                                sftp.readdir(payload.path, (err, list) => {
                                    if (err) return sendError(ws, getErrMsg(err, "Failed to access directory"));
                                    const files = list.map(f => ({
                                        name: f.filename,
                                        type: f.longname.startsWith("d") ? "folder" : "file",
                                        isSymlink: f.longname.startsWith("l"),
                                        last_modified: f.attrs.mtime,
                                        size: f.attrs.size,
                                    }));
                                    safeSend(ws, Buffer.concat([Buffer.from([OPERATIONS.LIST_FILES]), Buffer.from(JSON.stringify({ files }))]));
                                });
                                break;

                            case OPERATIONS.CREATE_FILE:
                                if (!payload?.path) return sendError(ws, "Invalid path");
                                {
                                    const writeStream = sftp.createWriteStream(payload.path);
                                    writeStream.on("error", (err) => sendError(ws, getErrMsg(err, "Failed to create file")));
                                    writeStream.on("close", () => {
                                        safeSend(ws, Buffer.from([OPERATIONS.CREATE_FILE]));
                                        createAuditLog({
                                            accountId: user.id,
                                            organizationId: entry.organizationId,
                                            action: AUDIT_ACTIONS.FILE_CREATE,
                                            resource: RESOURCE_TYPES.FILE,
                                            details: { filePath: payload.path },
                                            ipAddress,
                                            userAgent,
                                        });
                                    });
                                    writeStream.end();
                                }
                                break;

                            case OPERATIONS.CREATE_FOLDER:
                                if (!payload?.path) return sendError(ws, "Invalid path");
                                sftp.mkdir(payload.path, (err) => {
                                    if (err) return sendError(ws, getErrMsg(err, "Failed to create folder"));
                                    safeSend(ws, Buffer.from([OPERATIONS.CREATE_FOLDER]));
                                    createAuditLog({
                                        accountId: user.id,
                                        organizationId: entry.organizationId,
                                        action: AUDIT_ACTIONS.FOLDER_CREATE,
                                        resource: RESOURCE_TYPES.FOLDER,
                                        details: { folderPath: payload.path },
                                        ipAddress,
                                        userAgent,
                                    });
                                });
                                break;

                            case OPERATIONS.DELETE_FILE:
                                if (!payload?.path) return sendError(ws, "Invalid path");
                                sftp.unlink(payload.path, (err) => {
                                    if (err) return sendError(ws, getErrMsg(err, "Failed to delete file"));
                                    safeSend(ws, Buffer.from([OPERATIONS.DELETE_FILE]));
                                    createAuditLog({
                                        accountId: user.id,
                                        organizationId: entry.organizationId,
                                        action: AUDIT_ACTIONS.FILE_DELETE,
                                        resource: RESOURCE_TYPES.FILE,
                                        details: { filePath: payload.path },
                                        ipAddress,
                                        userAgent,
                                    });
                                });
                                break;

                            case OPERATIONS.DELETE_FOLDER:
                                if (!payload?.path) return sendError(ws, "Invalid path");
                                deleteFolderRecursive(sftp, payload.path, (err) => {
                                    if (err) return sendError(ws, getErrMsg(err, "Failed to delete folder"));
                                    safeSend(ws, Buffer.from([OPERATIONS.DELETE_FOLDER]));
                                    createAuditLog({
                                        accountId: user.id,
                                        organizationId: entry.organizationId,
                                        action: AUDIT_ACTIONS.FOLDER_DELETE,
                                        resource: RESOURCE_TYPES.FOLDER,
                                        details: { folderPath: payload.path },
                                        ipAddress,
                                        userAgent,
                                    });
                                });
                                break;

                            case OPERATIONS.RENAME_FILE:
                                if (!payload?.path || !payload?.newPath) return sendError(ws, "Invalid paths");
                                sftp.rename(payload.path, payload.newPath, (err) => {
                                    if (err) return sendError(ws, getErrMsg(err, "Failed to rename"));
                                    safeSend(ws, Buffer.from([OPERATIONS.RENAME_FILE]));
                                    createAuditLog({
                                        accountId: user.id,
                                        organizationId: entry.organizationId,
                                        action: AUDIT_ACTIONS.FILE_RENAME,
                                        resource: RESOURCE_TYPES.FILE,
                                        details: { oldPath: payload.path, newPath: payload.newPath },
                                        ipAddress,
                                        userAgent,
                                    });
                                });
                                break;

                            case OPERATIONS.SEARCH_DIRECTORIES:
                                if (!payload?.searchPath) return sendError(ws, "Invalid path");
                                searchDirectories(sftp, payload.searchPath, (err, dirs) => {
                                    if (err) return sendError(ws, "Search failed");
                                    safeSend(ws, Buffer.concat([Buffer.from([OPERATIONS.SEARCH_DIRECTORIES]), Buffer.from(JSON.stringify({ directories: dirs }))]));
                                });
                                break;

                            case OPERATIONS.RESOLVE_SYMLINK:
                                if (!payload?.path) return sendError(ws, "Invalid path");
                                sftp.realpath(payload.path, (err, realPath) => {
                                    if (err) return sendError(ws, getErrMsg(err, "Failed to resolve symlink"));
                                    sftp.stat(realPath, (err, stats) => {
                                        if (err) return sendError(ws, getErrMsg(err, "Failed to stat target"));
                                        safeSend(ws, Buffer.concat([Buffer.from([OPERATIONS.RESOLVE_SYMLINK]), Buffer.from(JSON.stringify({
                                            path: realPath,
                                            isDirectory: stats.isDirectory(),
                                        }))]));
                                    });
                                });
                                break;

                            case OPERATIONS.MOVE_FILES:
                                if (!payload?.sources?.length || !payload?.destination) return sendError(ws, "Invalid paths");
                                {
                                    let completed = 0, hasError = false;
                                    const total = payload.sources.length;
                                    const onDone = (err) => {
                                        if (hasError) return;
                                        if (err) { hasError = true; return sendError(ws, getErrMsg(err, "Failed to move")); }
                                        if (++completed === total) {
                                            safeSend(ws, Buffer.from([OPERATIONS.MOVE_FILES]));
                                            createAuditLog({
                                                accountId: user.id,
                                                organizationId: entry.organizationId,
                                                action: AUDIT_ACTIONS.FILE_RENAME,
                                                resource: RESOURCE_TYPES.FILE,
                                                details: { sources: payload.sources, destination: payload.destination },
                                                ipAddress,
                                                userAgent,
                                            });
                                        }
                                    };
                                    payload.sources.forEach(src => {
                                        const name = src.split("/").pop();
                                        const dest = `${payload.destination}/${name}`;
                                        sftp.rename(src, dest, onDone);
                                    });
                                }
                                break;

                            case OPERATIONS.COPY_FILES:
                                if (!payload?.sources?.length || !payload?.destination) return sendError(ws, "Invalid paths");
                                {
                                    const escapePath = (p) => `'${p.replace(/'/g, "'\\''")}'`;
                                    const copyCommands = payload.sources.map(src => {
                                        const name = src.split("/").pop();
                                        const dest = `${payload.destination}/${name}`;
                                        return `cp -r ${escapePath(src)} ${escapePath(dest)}`;
                                    }).join(" && ");
                                    
                                    ssh.exec(copyCommands, (err, stream) => {
                                        if (err) return sendError(ws, getErrMsg(err, "Failed to copy"));
                                        let stderr = "";
                                        stream.on("data", () => {});
                                        stream.stderr.on("data", (data) => { stderr += data.toString(); });
                                        stream.on("close", (code) => {
                                            if (code !== 0) {
                                                return sendError(ws, stderr.trim() || "Failed to copy files");
                                            }
                                            safeSend(ws, Buffer.from([OPERATIONS.COPY_FILES]));
                                            createAuditLog({
                                                accountId: user.id,
                                                organizationId: entry.organizationId,
                                                action: AUDIT_ACTIONS.FILE_CREATE,
                                                resource: RESOURCE_TYPES.FILE,
                                                details: { sources: payload.sources, destination: payload.destination },
                                                ipAddress,
                                                userAgent,
                                            });
                                        });
                                    });
                                }
                                break;
                        }
                    } catch (err) {
                        sendError(ws, "Operation failed: " + err.message);
                    }
                });
            });
        });
    } catch (err) {
        sendError(ws, "Connection failed: " + err.message);
        await cleanup("error");
        try {
            ws.close(4005);
        } catch {
        }
    }
};
