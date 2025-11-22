const wsAuth = require("../middlewares/wsAuth");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES, updateAuditLogWithSessionDuration } = require("../controllers/audit");
const { deleteFolderRecursive, searchDirectories, OPERATIONS } = require("../utils/sftpHelpers");
const { createSSHConnection } = require("../utils/sshConnection");
const logger = require("../utils/logger");

module.exports = async (ws, req) => {
    const context = await wsAuth(ws, req);
    if (!context) return;

    const { entry, identity, user, connectionReason, ipAddress, userAgent } = context;

    try {
        const connectionStartTime = Date.now();

        const sshAuditLogId = await createAuditLog({
            accountId: user.id,
            organizationId: entry.organizationId,
            action: AUDIT_ACTIONS.SSH_CONNECT,
            resource: RESOURCE_TYPES.ENTRY,
            resourceId: entry.id,
            details: { connectionReason },
            ipAddress,
            userAgent,
        });

        const ssh = await createSSHConnection(entry, identity, ws);

        ssh.on("error", async () => {
            await updateAuditLogWithSessionDuration(sshAuditLogId, connectionStartTime);
            if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
            ws.close();
        });

        ws.on("close", async () => {
            await updateAuditLogWithSessionDuration(sshAuditLogId, connectionStartTime);
            ssh.end();
            if (ssh._jumpConnections) ssh._jumpConnections.forEach(conn => conn.ssh.end());
        });

        logger.system(`Authorized SFTP connection to ${entry.config.ip} with identity ${identity.name}`, {
            entryId: entry.id,
            identityId: identity.id,
            username: user.username
        });

        ssh.on("ready", async () => {
            const sftpAuditLogId = await createAuditLog({
                accountId: user.id,
                organizationId: entry.organizationId,
                action: AUDIT_ACTIONS.SFTP_CONNECT,
                resource: RESOURCE_TYPES.SERVER,
                resourceId: entry.id,
                details: { connectionReason },
                ipAddress,
                userAgent,
            });

            ssh.sftp((err, sftp) => {
                if (err) {
                    logger.error("SFTP error", { error: err.message, entryId: entry.id });
                    return;
                }

                ws.send(Buffer.from([OPERATIONS.READY]));

                sftp.on("error", () => {});

                let uploadStream = null;

                ws.on("message", (msg) => {
                    const operation = msg[0];
                    let payload;

                    try {
                        payload = JSON.parse(msg.slice(1).toString());
                    } catch (ignored) {}

                    switch (operation) {
                        case OPERATIONS.LIST_FILES:
                            sftp.readdir(payload.path, (err, list) => {
                                if (err) {
                                    let errorMessage = "Failed to access directory";
                                    if (err.code === 2) {
                                        errorMessage = "Directory does not exist";
                                    } else if (err.code === 3) {
                                        errorMessage = "Permission denied - you don't have access to this directory";
                                    }

                                    ws.send(Buffer.concat([
                                        Buffer.from([OPERATIONS.ERROR]),
                                        Buffer.from(JSON.stringify({ message: errorMessage })),
                                    ]));
                                    return;
                                }
                                const files = list.map(file => ({
                                    name: file.filename,
                                    type: file.longname.startsWith("d") ? "folder" : "file",
                                    last_modified: file.attrs.mtime,
                                    size: file.attrs.size,
                                }));
                                ws.send(Buffer.concat([
                                    Buffer.from([OPERATIONS.LIST_FILES]),
                                    Buffer.from(JSON.stringify({ files })),
                                ]));
                            });
                            break;

                        case OPERATIONS.UPLOAD_FILE_START:
                            if (uploadStream) {
                                uploadStream.end();
                            }

                            try {
                                uploadStream = sftp.createWriteStream(payload.path);
                                uploadStream.on("error", () => {
                                    uploadStream = null;
                                    ws.send(Buffer.concat([
                                        Buffer.from([OPERATIONS.ERROR]),
                                        Buffer.from(JSON.stringify({ message: "Permission denied - unable to upload file to this location" })),
                                    ]));
                                });

                                ws.send(Buffer.from([OPERATIONS.UPLOAD_FILE_START]));
                            } catch (err) {
                                uploadStream = null;
                                ws.send(Buffer.concat([
                                    Buffer.from([OPERATIONS.ERROR]),
                                    Buffer.from(JSON.stringify({ message: "Failed to start file upload" })),
                                ]));
                            }
                            break;

                        case OPERATIONS.UPLOAD_FILE_CHUNK:
                            try {
                                if (uploadStream && !uploadStream.destroyed) {
                                    uploadStream.write(Buffer.from(payload.chunk, "base64"));
                                }
                            } catch (err) {
                                uploadStream = null;
                                ws.send(Buffer.concat([
                                    Buffer.from([OPERATIONS.ERROR]),
                                    Buffer.from(JSON.stringify({ message: "Failed to write file chunk" })),
                                ]));
                            }
                            break;

                        case OPERATIONS.UPLOAD_FILE_END:
                            try {
                                if (uploadStream && !uploadStream.destroyed) {
                                    uploadStream.end(() => {
                                        uploadStream = null;
                                        ws.send(Buffer.from([OPERATIONS.UPLOAD_FILE_END]));

                                        createAuditLog({
                                            accountId: user.id,
                                            organizationId: entry.organizationId,
                                            action: AUDIT_ACTIONS.FILE_UPLOAD,
                                            resource: RESOURCE_TYPES.FILE,
                                            details: { filePath: payload.path },
                                            ipAddress,
                                            userAgent,
                                        });
                                    });
                                } else {
                                    uploadStream = null;
                                    ws.send(Buffer.concat([
                                        Buffer.from([OPERATIONS.ERROR]),
                                        Buffer.from(JSON.stringify({ message: "Upload stream is not available" })),
                                    ]));
                                }
                            } catch (err) {
                                uploadStream = null;
                                ws.send(Buffer.concat([
                                    Buffer.from([OPERATIONS.ERROR]),
                                    Buffer.from(JSON.stringify({ message: "Failed to complete file upload" })),
                                ]));
                            }
                            break;

                        case OPERATIONS.CREATE_FOLDER:
                            sftp.mkdir(payload.path, (err) => {
                                if (err) {
                                    let errorMessage = "Failed to create folder";
                                    if (err.code === 3) {
                                        errorMessage = "Permission denied - you don't have permission to create folders here";
                                    } else if (err.code === 4) {
                                        errorMessage = "Folder already exists";
                                    }

                                    ws.send(Buffer.concat([
                                        Buffer.from([OPERATIONS.ERROR]),
                                        Buffer.from(JSON.stringify({ message: errorMessage })),
                                    ]));
                                    return;
                                }
                                ws.send(Buffer.from([OPERATIONS.CREATE_FOLDER]));

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
                            sftp.unlink(payload.path, (err) => {
                                if (err) {
                                    logger.warn("Delete file error", { error: err.message, path: payload.path });
                                    return;
                                }
                                ws.send(Buffer.from([OPERATIONS.DELETE_FILE]));

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
                            deleteFolderRecursive(sftp, payload.path, (err) => {
                                if (err) {
                                    logger.warn("Delete folder error", { error: err.message, path: payload.path });
                                    return;
                                }
                                ws.send(Buffer.from([OPERATIONS.DELETE_FOLDER]));

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
                            sftp.rename(payload.path, payload.newPath, (err) => {
                                if (err) {
                                    logger.warn("Rename file error", { error: err.message, path: payload.path, newPath: payload.newPath });
                                    return;
                                }
                                ws.send(Buffer.from([OPERATIONS.RENAME_FILE]));

                                createAuditLog({
                                    accountId: user.id,
                                    organizationId: entry.organizationId,
                                    action: AUDIT_ACTIONS.FILE_RENAME,
                                    resource: RESOURCE_TYPES.FILE,
                                    details: {
                                        oldPath: payload.path,
                                        newPath: payload.newPath,
                                    },
                                    ipAddress,
                                    userAgent,
                                });
                            });
                            break;

                        case OPERATIONS.SEARCH_DIRECTORIES:
                            searchDirectories(sftp, payload.searchPath, (err, directories) => {
                                if (err) {
                                    ws.send(Buffer.concat([
                                        Buffer.from([OPERATIONS.ERROR]),
                                        Buffer.from(JSON.stringify({ message: "Failed to search directories" })),
                                    ]));
                                    return;
                                }

                                ws.send(Buffer.concat([
                                    Buffer.from([OPERATIONS.SEARCH_DIRECTORIES]),
                                    Buffer.from(JSON.stringify({ directories })),
                                ]));
                            });
                            break;

                        default:
                            logger.warn(`Unknown SFTP operation`, { operation });
                    }
                });

                ws.on("close", async () => {
                    await updateAuditLogWithSessionDuration(sftpAuditLogId, connectionStartTime);
                });
            });
        });
    } catch (error) {
        logger.error("SFTP connection error", { error: error.message, stack: error.stack });
        ws.close(4005, error.message);
    }
};
