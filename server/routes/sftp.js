const { Router } = require("express");
const express = require("express");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const Session = require("../models/Session");
const Account = require("../models/Account");
const SessionManager = require("../lib/SessionManager");
const TransferRegistry = require("../lib/TransferRegistry");
const { isCancelled } = require("../lib/EngineSftpClient");
const { getSFTPTransferClient, getSFTPBackgroundClient } = require("../lib/ConnectionService");
const Entry = require("../models/Entry");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { hasResourcePermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const logger = require("../utils/logger");
const { ZipArchive } = require("archiver");

const app = Router();
const THUMB_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
const MAX_THUMB_SIZE = 10 * 1024 * 1024;
const MIME_TYPES = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4",
    webm: "video/webm", mp3: "audio/mpeg", txt: "text/plain", json: "application/json",
    html: "text/html", css: "text/css", js: "application/javascript",
};

const getExt = (p) => p.split(".").pop()?.toLowerCase();
const getFileName = (p) => p.split("/").pop();
const sanitizeFileName = (name) => name.replaceAll(/[^\w\s.-]/g, "_").substring(0, 255);
const isUnsafePath = (p) => typeof p !== "string" || p.length === 0 || p.split("/").includes("..");

const handleError = (res, err) => {
    if (res.headersSent) {
        res.destroy();
        return;
    }
    const msg = err.message || "Internal error";
    if (msg.includes("does not exist")) return res.status(404).json({ error: "Not found" });
    if (msg.includes("Permission denied")) return res.status(403).json({ error: "Permission denied" });
    res.status(500).json({ error: msg });
};

const checkFilePermission = (ctx, permission) =>
    hasResourcePermission(ctx.user.id, ctx.entry.organizationId, permission);

const audit = (ctx, req, action, resource, details) => {
    createAuditLog({
        accountId: ctx.user.id, organizationId: ctx.entry.organizationId,
        action, resource, details, ipAddress: req.ip, userAgent: req.headers["user-agent"],
    });
};

const createByteCounter = (onBytes) => {
    let count = 0;
    return new Transform({
        transform(chunk, _encoding, callback) {
            count += chunk.length;
            onBytes(count);
            callback(null, chunk);
        },
    });
};

const createArchiveJob = (sftpClient, archive) => {
    let aborted = false;
    let activeRead = null;

    const appendFile = async (remotePath, archivePath) => {
        if (aborted) return;
        const read = sftpClient.readFile(remotePath);
        activeRead = read;
        try {
            await read.totalSizePromise;
            archive.append(read.stream, { name: archivePath });
            await read.done;
        } finally {
            activeRead = null;
        }
    };

    const appendFolder = async (dirPath, basePath) => {
        if (aborted) return;
        const entries = await sftpClient.listDir(dirPath);
        if (entries.length === 0) {
            archive.append("", { name: basePath + "/" });
            return;
        }
        for (const entry of entries) {
            if (aborted) return;
            if (entry.isSymlink) continue;
            const fullPath = dirPath === "/" ? `/${entry.name}` : `${dirPath}/${entry.name}`;
            const archivePath = basePath ? `${basePath}/${entry.name}` : entry.name;
            if (entry.type === "folder") await appendFolder(fullPath, archivePath);
            else await appendFile(fullPath, archivePath);
        }
    };

    const appendItems = async (paths) => {
        for (const remotePath of paths) {
            if (aborted) return;
            try {
                const stats = await sftpClient.stat(remotePath);
                const name = getFileName(remotePath);
                if (stats.isDir) await appendFolder(remotePath, name);
                else await appendFile(remotePath, name);
            } catch (err) {
                if (aborted || isCancelled(err)) throw err;
                logger.warn("Failed to add item to archive", { path: remotePath, error: err.message });
            }
        }
    };

    const abort = () => {
        aborted = true;
        activeRead?.cancel();
    };

    return { appendFolder, appendItems, abort, get aborted() { return aborted; } };
};

const validateSession = async (sessionToken, sessionId) => {
    const session = await Session.findOne({ where: { token: sessionToken } });
    if (!session) return { error: "Invalid session", status: 401 };

    const [user, serverSession] = await Promise.all([
        Account.findByPk(session.accountId),
        Session.update({ lastActivity: new Date() }, { where: { id: session.id } }).then(() => SessionManager.get(sessionId)),
    ]);

    if (!user) return { error: "User not found", status: 401 };
    if (!serverSession) return { error: "Session not found", status: 404 };
    if (serverSession.accountId !== user.id) return { error: "Unauthorized", status: 403 };

    const entry = await Entry.findByPk(serverSession.entryId);
    if (!entry) return { error: "Entry not found", status: 404 };

    const conn = SessionManager.getConnection(sessionId);
    if (!conn?.sftpClient) return { error: "No active SFTP connection", status: 400 };

    return { session, user, serverSession, entry, sessionId, metadataClient: conn.sftpClient };
};

const resolveClient = async (ctx, getClient, label) => {
    try {
        return await getClient(ctx.sessionId, ctx.entry, ctx.user.id);
    } catch (err) {
        logger.warn(`Falling back to metadata SFTP client for ${label}`, { sessionId: ctx.sessionId, error: err.message });
        return ctx.metadataClient;
    }
};

const resolveTransferClient = (ctx) => resolveClient(ctx, getSFTPTransferClient, "transfer");
const resolveBackgroundClient = (ctx) => resolveClient(ctx, getSFTPBackgroundClient, "thumbnail");

const validateRequest = (query) => {
    const { sessionToken, sessionId, path: remotePath } = query;
    if (!sessionToken || !sessionId || !remotePath) return "Missing parameters";
    if (isUnsafePath(remotePath)) return "Invalid path";
    if (query.transferId !== undefined && !TransferRegistry.isValidTransferId(query.transferId)) return "Invalid transfer id";
    return null;
};

const resolveTransferId = (query) => query.transferId || null;

const finishTransfer = (transferId, err) => {
    if (!err) TransferRegistry.finish(transferId);
    else if (isCancelled(err)) TransferRegistry.finish(transferId, { cancelled: true });
    else TransferRegistry.finish(transferId, { error: err.message });
};

const isClientGone = (res) => res.destroyed || res.socket?.destroyed;

const streamFile = async (ctx, req, res, sftpClient, remotePath, stats, transferId) => {
    const fileName = getFileName(remotePath);
    const disposition = req.query.preview === "true" ? "inline" : "attachment";
    res.header("Content-Disposition", `${disposition}; filename="${sanitizeFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.header("Content-Length", stats.size);
    const ext = getExt(remotePath);
    if (MIME_TYPES[ext]) res.header("Content-Type", MIME_TYPES[ext]);

    const read = sftpClient.readFile(remotePath);
    let delivered = 0;
    const fullyDelivered = () => delivered >= stats.size;
    TransferRegistry.register({
        id: transferId, sessionId: ctx.sessionId, name: fileName, direction: "download",
        total: stats.size, cancel: () => { read.cancel(); res.destroy(); },
    });
    res.on("close", () => { if (!fullyDelivered()) read.cancel(); });

    const counter = createByteCounter((count) => {
        delivered = count;
        TransferRegistry.progress(transferId, count);
    });

    const succeed = () => {
        TransferRegistry.finish(transferId);
        audit(ctx, req, AUDIT_ACTIONS.FILE_DOWNLOAD, RESOURCE_TYPES.FILE, { filePath: remotePath, fileSize: stats.size });
    };

    try {
        await pipeline(read.stream, counter, res);
        await read.done;
        succeed();
    } catch (err) {
        if (fullyDelivered() && !isCancelled(err)) {
            try {
                await read.done;
                succeed();
                return;
            } catch (doneErr) {
                err = doneErr;
            }
        }
        const cause = isClientGone(res) && !isCancelled(err) ? Object.assign(new Error("Transfer cancelled"), { cancelled: true }) : err;
        finishTransfer(transferId, cause);
        if (!isCancelled(cause)) logger.warn("Download failed", { path: remotePath, error: cause.message });
        handleError(res, cause);
    }
};

const streamArchive = async (ctx, req, res, sftpClient, transferId, name, populate) => {
    res.header("Content-Disposition", `attachment; filename="${name}"`);
    res.header("Content-Type", "application/zip");

    const archive = new ZipArchive({ zlib: { level: 1 } });
    const job = createArchiveJob(sftpClient, archive);
    TransferRegistry.register({
        id: transferId, sessionId: ctx.sessionId, name, direction: "download",
        total: 0, cancel: () => { job.abort(); res.destroy(); },
    });
    res.on("close", () => job.abort());

    const counter = createByteCounter((count) => TransferRegistry.progress(transferId, count));
    const output = pipeline(archive, counter, res);
    output.catch(() => {});

    try {
        await populate(job);
        if (job.aborted) throw Object.assign(new Error("Transfer cancelled"), { cancelled: true });
        await archive.finalize();
        await output;
        TransferRegistry.finish(transferId);
        return true;
    } catch (err) {
        const cause = job.aborted || isClientGone(res) ? Object.assign(new Error("Transfer cancelled"), { cancelled: true }) : err;
        archive.abort();
        finishTransfer(transferId, cause);
        if (!isCancelled(cause)) logger.warn("Archive download failed", { name, error: cause.message });
        handleError(res, cause);
        return false;
    }
};

/**
 * POST /sftp/upload
 * @summary Upload File via SFTP
 * @description Uploads a file to a remote server via SFTP. The file content should be sent as the raw request body. Missing parent directories are created when the user is allowed to modify files. Progress is pushed to the session's SFTP websockets when a transferId is given. Requires an active session with SFTP capabilities.
 * @tags SFTP
 * @produces application/json
 * @param {string} sessionToken.query.required - Session authentication token
 * @param {string} sessionId.query.required - Active server session ID
 * @param {string} path.query.required - Remote destination path for the uploaded file
 * @param {string} transferId.query - Client-chosen identifier used for progress reporting and cancellation
 * @return {object} 200 - Upload successful with file path and size
 * @return {object} 400 - Missing parameters or invalid path
 * @return {object} 401 - Invalid session token
 * @return {object} 403 - Permission denied
 * @return {object} 404 - Session or entry not found
 * @return {object} 500 - Upload error
 */
app.post("/upload", async (req, res) => {
    const error = validateRequest(req.query);
    if (error) return res.status(400).json({ error });

    const { sessionToken, sessionId, path: remotePath } = req.query;
    const transferId = resolveTransferId(req.query);
    let registered = false;

    try {
        const ctx = await validateSession(sessionToken, sessionId);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

        if (!(await checkFilePermission(ctx, Permission.FILES_UPLOAD)))
            return res.status(403).json({ error: "You don't have permission to upload files" });

        const sftpClient = await resolveTransferClient(ctx);

        const parentPath = remotePath.substring(0, remotePath.lastIndexOf("/"));
        if (parentPath && await checkFilePermission(ctx, Permission.FILES_MODIFY)) {
            const created = await sftpClient.mkdirRecursive(parentPath);
            for (const folderPath of created)
                audit(ctx, req, AUDIT_ACTIONS.FOLDER_CREATE, RESOURCE_TYPES.FOLDER, { folderPath });
        }

        const totalSize = Number.parseInt(req.headers["content-length"]) || 0;
        const abortController = new AbortController();
        TransferRegistry.register({
            id: transferId, sessionId, name: getFileName(remotePath), direction: "upload",
            total: totalSize, cancel: () => { abortController.abort(); req.destroy(); },
        });
        registered = true;

        await sftpClient.writeFile(remotePath, req, {
            signal: abortController.signal,
            onProgress: (sent) => TransferRegistry.progress(transferId, sent),
        });

        TransferRegistry.finish(transferId);
        res.json({ success: true, path: remotePath, size: totalSize });
        audit(ctx, req, AUDIT_ACTIONS.FILE_UPLOAD, RESOURCE_TYPES.FILE, { filePath: remotePath, fileSize: totalSize });
    } catch (err) {
        const cause = req.destroyed && !isCancelled(err) ? Object.assign(new Error("Transfer cancelled"), { cancelled: true }) : err;
        if (registered) finishTransfer(transferId, cause);
        if (!isCancelled(cause)) logger.error("Upload error", { error: cause.message, path: remotePath });
        handleError(res, cause);
    }
});

/**
 * GET /sftp
 * @summary Download or Preview File via SFTP
 * @description Downloads a file or folder from a remote server via SFTP. Supports file preview, thumbnail generation for images, and folder download as ZIP archive. Progress is pushed to the session's SFTP websockets when a transferId is given.
 * @tags SFTP
 * @produces application/octet-stream
 * @produces application/zip
 * @produces image/jpeg
 * @param {string} sessionToken.query.required - Session authentication token
 * @param {string} sessionId.query.required - Active server session ID
 * @param {string} path.query.required - Remote file or folder path to download
 * @param {string} preview.query - Set to "true" to display file inline instead of downloading
 * @param {string} thumbnail.query - Set to "true" to generate a thumbnail (images only, max 10MB)
 * @param {number} size.query - Thumbnail size in pixels (50-300, default: 100)
 * @param {string} transferId.query - Client-chosen identifier used for progress reporting and cancellation
 * @return {file} 200 - File content, ZIP archive, or thumbnail image
 * @return {object} 400 - Missing parameters or invalid path
 * @return {object} 401 - Invalid session token
 * @return {object} 403 - Permission denied
 * @return {object} 404 - File, session, or entry not found
 * @return {object} 500 - Download error
 */
app.get("/", async (req, res) => {
    const error = validateRequest(req.query);
    if (error) return res.status(400).json({ error });

    const { sessionToken, sessionId, path: remotePath, thumbnail, size } = req.query;

    try {
        const ctx = await validateSession(sessionToken, sessionId);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

        if (!(await checkFilePermission(ctx, Permission.FILES_DOWNLOAD)))
            return res.status(403).json({ error: "You don't have permission to download files" });

        if (thumbnail === "true") {
            if (!THUMB_EXTS.has(getExt(remotePath))) return res.status(415).json({ error: "Thumbnails are not supported for this file type" });
            const sftpClient = await resolveBackgroundClient(ctx);
            const stats = await sftpClient.stat(remotePath);
            if (stats.isDir || stats.size > MAX_THUMB_SIZE) return res.status(413).json({ error: "File too large for thumbnail" });
            const thumbSize = Math.min(Math.max(Number.parseInt(size) || 100, 50), 300);
            const { data } = await sftpClient.thumbnail(remotePath, thumbSize);
            res.header("Content-Type", "image/jpeg");
            res.header("Cache-Control", "public, max-age=3600");
            res.end(data);
            return;
        }

        const sftpClient = await resolveTransferClient(ctx);
        const stats = await sftpClient.stat(remotePath);
        const transferId = resolveTransferId(req.query);

        if (stats.isDir) {
            const archiveName = `${sanitizeFileName(getFileName(remotePath))}.zip`;
            const ok = await streamArchive(ctx, req, res, sftpClient, transferId, archiveName,
                (job) => job.appendFolder(remotePath, sanitizeFileName(getFileName(remotePath))));
            if (ok) audit(ctx, req, AUDIT_ACTIONS.FOLDER_DOWNLOAD, RESOURCE_TYPES.FOLDER, { folderPath: remotePath });
            return;
        }

        await streamFile(ctx, req, res, sftpClient, remotePath, stats, transferId);
    } catch (err) {
        handleError(res, err);
    }
});

/**
 * POST /sftp/multi
 * @summary Download Multiple Files via SFTP
 * @description Downloads multiple files and/or folders as a single ZIP archive. Supports mixed selection of files and folders. Failed items are skipped and logged. Progress is pushed to the session's SFTP websockets when a transferId is given.
 * @tags SFTP
 * @consumes application/x-www-form-urlencoded
 * @produces application/zip
 * @param {string} sessionToken.query.required - Session authentication token
 * @param {string} sessionId.query.required - Active server session ID
 * @param {string} transferId.query - Client-chosen identifier used for progress reporting and cancellation
 * @param {object} request.body.required - Request body containing paths array
 * @return {file} 200 - ZIP archive containing all requested files and folders
 * @return {object} 400 - Missing parameters, invalid paths format, or no paths provided
 * @return {object} 401 - Invalid session token
 * @return {object} 403 - Permission denied
 * @return {object} 404 - Session or entry not found
 * @return {object} 500 - Download error
 */
app.post("/multi", express.urlencoded({ extended: true }), async (req, res) => {
    const { sessionToken, sessionId } = req.query;
    let { paths } = req.body;

    if (typeof paths === "string") {
        try { paths = JSON.parse(paths); }
        catch { return res.status(400).json({ error: "Invalid paths format" }); }
    }

    if (!sessionToken || !sessionId) return res.status(400).json({ error: "Missing session parameters" });
    if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: "No paths provided" });
    if (paths.some(isUnsafePath)) return res.status(400).json({ error: "Invalid path" });
    if (req.query.transferId !== undefined && !TransferRegistry.isValidTransferId(req.query.transferId))
        return res.status(400).json({ error: "Invalid transfer id" });

    try {
        const ctx = await validateSession(sessionToken, sessionId);
        if (ctx.error) return res.status(ctx.status).json({ error: ctx.error });

        if (!(await checkFilePermission(ctx, Permission.FILES_DOWNLOAD)))
            return res.status(403).json({ error: "You don't have permission to download files" });

        const sftpClient = await resolveTransferClient(ctx);
        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-").slice(0, 19);
        const archiveName = paths.length === 1
            ? `${sanitizeFileName(getFileName(paths[0]))}.zip`
            : `nexterm-download-${timestamp}.zip`;

        const ok = await streamArchive(ctx, req, res, sftpClient, resolveTransferId(req.query), archiveName,
            (job) => job.appendItems(paths));
        if (!ok) return;

        audit(ctx, req, AUDIT_ACTIONS.FILE_DOWNLOAD, RESOURCE_TYPES.FILE, {
            paths,
            count: paths.length,
            connectionReason: ctx.serverSession.connectionReason || null,
        });
    } catch (err) {
        handleError(res, err);
    }
});

module.exports = app;
