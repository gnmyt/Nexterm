const prepareSSH = require("../utils/sshPreCheck");
const {
    createAuditLog,
    AUDIT_ACTIONS,
    RESOURCE_TYPES,
    updateAuditLogWithSessionDuration,
} = require("../controllers/audit");

const deleteFolderRecursive = (sftp, folderPath, callback) => {
    sftp.readdir(folderPath, (err, list) => {
        if (err) return callback(err);

        if (list.length === 0) return sftp.rmdir(folderPath, callback);

        let itemsToDelete = list.length;

        list.forEach(file => {
            const fullPath = `${folderPath}/${file.filename}`;

            if (file.longname.startsWith("d")) {
                deleteFolderRecursive(sftp, fullPath, (err) => {
                    if (err) return callback(err);

                    itemsToDelete -= 1;
                    if (itemsToDelete === 0) sftp.rmdir(folderPath, callback);
                });
            } else {
                sftp.unlink(fullPath, (err) => {
                    if (err) return callback(err);

                    itemsToDelete -= 1;
                    if (itemsToDelete === 0) sftp.rmdir(folderPath, callback);
                });
            }
        });
    });
};

const searchDirectories = (sftp, searchPath, callback, maxResults = 20) => {
    const results = [];
    const searchQuery = searchPath.toLowerCase();

    const isSearchingInside = searchPath.endsWith("/");
    let basePath, searchTerm;

    if (isSearchingInside) {
        basePath = searchPath === "/" ? "/" : searchPath.slice(0, -1);
        searchTerm = "";
    } else {
        const lastSlashIndex = searchPath.lastIndexOf("/");
        basePath = lastSlashIndex === 0 ? "/" : searchPath.substring(0, lastSlashIndex);
        searchTerm = searchPath.substring(lastSlashIndex + 1).toLowerCase();
    }

    const searchRecursive = (currentPath, depth = 0) => {
        if (depth > 3 || results.length >= maxResults) return;

        sftp.readdir(currentPath, (err, list) => {
            if (err || !list) return;

            list.forEach(file => {
                if (!file.longname.startsWith("d")) return;

                const fullPath = currentPath === "/" ? `/${file.filename}` : `${currentPath}/${file.filename}`;
                const fileName = file.filename.toLowerCase();

                if (isSearchingInside) {
                    if (currentPath === basePath) results.push(fullPath);
                } else {
                    if (fileName.startsWith(searchTerm) || fullPath.toLowerCase().includes(searchQuery)) results.push(fullPath);
                }

                if (results.length < maxResults && depth < 3) searchRecursive(fullPath, depth + 1);
            });

            if (depth === 0) {
                const uniqueResults = [...new Set(results)].sort();
                callback(null, uniqueResults.slice(0, maxResults));
            }
        });
    };

    searchRecursive(basePath || "/");
};

module.exports = async (ws, req) => {
    const ssh = await prepareSSH(ws, req);
    if (!ssh) return;

    req.user = req.user || {};
    req.server = req.server || {};

    const OPERATIONS = {
        READY: 0x0,
        LIST_FILES: 0x1,
        UPLOAD_FILE_START: 0x2,
        UPLOAD_FILE_CHUNK: 0x3,
        UPLOAD_FILE_END: 0x4,
        CREATE_FOLDER: 0x5,
        DELETE_FILE: 0x6,
        DELETE_FOLDER: 0x7,
        RENAME_FILE: 0x8,
        ERROR: 0x9,
        SEARCH_DIRECTORIES: 0xA,
    };

    let uploadStream = null;

    ssh.on("error", async () => {
        await updateAuditLogWithSessionDuration(ssh.auditLogId, ssh.connectionStartTime);
        ws.close();
    });

    ws.on("close", async () => {
        await updateAuditLogWithSessionDuration(ssh.auditLogId, ssh.connectionStartTime);
        ssh.end();
    });

    ssh.on("ready", () => {
        createAuditLog({
            accountId: req.user?.id,
            organizationId: req.server?.organizationId,
            action: AUDIT_ACTIONS.SFTP_CONNECT,
            resource: RESOURCE_TYPES.SERVER,
            resourceId: req.server?.id,
            details: {
                connectionReason: req.query?.connectionReason,
            },
            ipAddress: req.ip,
            userAgent: req.headers?.["user-agent"],
        });

        ssh.sftp((err, sftp) => {
            if (err) {
                console.log(err);
                return;
            }

            ws.send(Buffer.from([OPERATIONS.READY]));

            sftp.on("error", () => {});

            ws.on("message", (msg) => {
                const operation = msg[0];
                let payload;

                try {
                    payload = JSON.parse(msg.slice(1).toString());
                } catch (ignored) {
                }

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
                                        accountId: req.user?.id,
                                        organizationId: req.server?.organizationId,
                                        action: AUDIT_ACTIONS.FILE_UPLOAD,
                                        resource: RESOURCE_TYPES.FILE,
                                        details: { filePath: payload.path },
                                        ipAddress: req.ip,
                                        userAgent: req.headers?.["user-agent"],
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
                                accountId: req.user?.id,
                                organizationId: req.server?.organizationId,
                                action: AUDIT_ACTIONS.FOLDER_CREATE,
                                resource: RESOURCE_TYPES.FOLDER,
                                details: { folderPath: payload.path },
                                ipAddress: req.ip,
                                userAgent: req.headers?.["user-agent"],
                            });
                        });
                        break;

                    case OPERATIONS.DELETE_FILE:
                        sftp.unlink(payload.path, (err) => {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            ws.send(Buffer.from([OPERATIONS.DELETE_FILE]));

                            createAuditLog({
                                accountId: req.user?.id,
                                organizationId: req.server?.organizationId,
                                action: AUDIT_ACTIONS.FILE_DELETE,
                                resource: RESOURCE_TYPES.FILE,
                                details: { filePath: payload.path },
                                ipAddress: req.ip,
                                userAgent: req.headers?.["user-agent"],
                            });
                        });
                        break;

                    case OPERATIONS.DELETE_FOLDER:
                        deleteFolderRecursive(sftp, payload.path, (err) => {
                            if (err) {
                                return;
                            }
                            ws.send(Buffer.from([OPERATIONS.DELETE_FOLDER]));

                            createAuditLog({
                                accountId: req.user?.id,
                                organizationId: req.server?.organizationId,
                                action: AUDIT_ACTIONS.FOLDER_DELETE,
                                resource: RESOURCE_TYPES.FOLDER,
                                details: { folderPath: payload.path },
                                ipAddress: req.ip,
                                userAgent: req.headers?.["user-agent"],
                            });
                        });
                        break;
                    case OPERATIONS.RENAME_FILE:
                        sftp.rename(payload.path, payload.newPath, (err) => {
                            if (err) {
                                return;
                            }
                            ws.send(Buffer.from([OPERATIONS.RENAME_FILE]));

                            createAuditLog({
                                accountId: req.user?.id,
                                organizationId: req.server?.organizationId,
                                action: AUDIT_ACTIONS.FILE_RENAME,
                                resource: RESOURCE_TYPES.FILE,
                                details: {
                                    oldPath: payload.path,
                                    newPath: payload.newPath,
                                },
                                ipAddress: req.ip,
                                userAgent: req.headers?.["user-agent"],
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
                        console.log(`Unknown operation: ${operation}`);
                }
            });
        });
    });
};