const { Router } = require("express");
const Session = require("../models/Session");
const Account = require("../models/Account");
const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");
const Identity = require("../models/Identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");
const { createSSH } = require("../utils/createSSH");
const { addFolderToArchive } = require("../utils/sftpHelpers");
const logger = require("../utils/logger");
const archiver = require("archiver");
const sharp = require("sharp");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = Router();
const THUMB_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
const TIMEOUT = 30000;
const MIME_TYPES = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", mp4: "video/mp4",
    webm: "video/webm", mp3: "audio/mpeg", txt: "text/plain", json: "application/json",
    html: "text/html", css: "text/css", js: "application/javascript",
};

const getExt = (p) => p.split(".").pop()?.toLowerCase();

const cleanup = (ssh, streams = []) => {
    streams.forEach(s => { try { s?.destroyed || s?.destroy(); } catch {} });
    try { ssh?._jumpConnections?.forEach(c => { try { c.ssh.end(); } catch {} }); ssh?.end(); } catch {}
};

const sftpConnect = (ssh) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SFTP timeout")), TIMEOUT);
    ssh.sftp((err, sftp) => { clearTimeout(t); err ? reject(err) : resolve(sftp); });
});

const connectSSH = (ssh, sshOptions) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timeout")), TIMEOUT);
    ssh.on("ready", () => { clearTimeout(t); resolve(); });
    ssh.on("error", (e) => { clearTimeout(t); reject(e); });
    ssh.connect(sshOptions);
});

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

    const identityId = serverSession.configuration?.identityId;
    if (!identityId) return { error: "No identity configured", status: 400 };

    const identity = await Identity.findByPk(identityId);
    if (!identity) return { error: "Identity not found", status: 404 };

    return { session, user, serverSession, entry, identity };
};

const setupSSH = async (v, req, res, cleanupFn) => {
    const { ssh, sshOptions } = await createSSH(v.entry, v.identity, {}, v.user.id);
    req.on("close", () => { if (!res.writableEnded) cleanupFn(); });
    ssh.on("error", (err) => { cleanupFn(); if (!res.headersSent) res.status(500).json({ error: err.message }); });
    return { ssh, sshOptions };
};

const handleError = (res, err) => {
    const status = err.code === 2 ? 404 : err.code === 3 ? 403 : 500;
    const msg = err.code === 2 ? "Not found" : err.code === 3 ? "Permission denied" : err.message;
    if (!res.headersSent) res.status(status).json({ error: msg });
};

const audit = (v, req, action, resource, details) => {
    createAuditLog({
        accountId: v.user.id, organizationId: v.entry.organizationId,
        action, resource, details, ipAddress: req.ip, userAgent: req.headers["user-agent"],
    });
};

app.post("/upload", async (req, res) => {
    const { sessionToken, sessionId, path: remotePath } = req.query;
    if (!sessionToken || !sessionId || !remotePath) return res.status(400).json({ error: "Missing parameters" });
    if (remotePath.includes("..")) return res.status(400).json({ error: "Invalid path" });

    let ssh = null, tempFile = null, cleaned = false;
    const cleanupAll = () => {
        if (cleaned) return;
        cleaned = true;
        if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
        cleanup(ssh);
    };

    try {
        const v = await validateSession(sessionToken, sessionId);
        if (v.error) return res.status(v.status).json({ error: v.error });

        tempFile = path.join(os.tmpdir(), `nexterm-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const writeStream = fs.createWriteStream(tempFile);

        await new Promise((resolve, reject) => {
            req.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
            req.on("error", reject);
        });

        const stats = fs.statSync(tempFile);
        const setup = await setupSSH(v, req, res, cleanupAll);
        ssh = setup.ssh;

        await connectSSH(ssh, setup.sshOptions);
        const sftp = await sftpConnect(ssh);

        await new Promise((resolve, reject) => {
            sftp.fastPut(tempFile, remotePath, { concurrency: 64, chunkSize: 32768 }, (err) => err ? reject(err) : resolve());
        });

        cleanupAll();
        res.json({ success: true, path: remotePath, size: stats.size });
        audit(v, req, AUDIT_ACTIONS.FILE_UPLOAD, RESOURCE_TYPES.FILE, { filePath: remotePath, fileSize: stats.size });
    } catch (err) {
        cleanupAll();
        logger.error("Upload error", { error: err.message, path: remotePath });
        handleError(res, err);
    }
});

app.get("/", async (req, res) => {
    const { sessionToken, sessionId, path: remotePath, preview, thumbnail, size } = req.query;
    if (!sessionToken || !sessionId || !remotePath) return res.status(400).json({ error: "Missing parameters" });
    if (remotePath.includes("..")) return res.status(400).json({ error: "Invalid path" });

    const thumbSize = Math.min(Math.max(parseInt(size) || 100, 50), 300);
    let ssh = null;
    const streams = [];
    let cleaned = false;
    const cleanupAll = () => { if (cleaned) return; cleaned = true; cleanup(ssh, streams); };

    try {
        const v = await validateSession(sessionToken, sessionId);
        if (v.error) return res.status(v.status).json({ error: v.error });

        const setup = await setupSSH(v, req, res, cleanupAll);
        ssh = setup.ssh;
        ssh.on("end", cleanupAll);
        ssh.connect(setup.sshOptions);

        ssh.on("ready", async () => {
            try {
                const sftp = await sftpConnect(ssh);
                const stats = await new Promise((r, j) => sftp.stat(remotePath, (e, s) => e ? j(e) : r(s)));
                const fileName = remotePath.split("/").pop();
                const safeFileName = fileName.replace(/[^\w\s.-]/g, "_").substring(0, 255);

                if (stats.isDirectory()) {
                    res.header("Content-Disposition", `attachment; filename="${safeFileName}.zip"`);
                    res.header("Content-Type", "application/zip");
                    const archive = archiver("zip", { zlib: { level: 5 } });
                    streams.push(archive);
                    archive.on("error", () => { archive.abort(); cleanupAll(); });
                    archive.on("end", cleanupAll);
                    archive.pipe(res);
                    await addFolderToArchive(sftp, remotePath, archive, safeFileName, streams);
                    archive.finalize();
                    audit(v, req, AUDIT_ACTIONS.FOLDER_DOWNLOAD, RESOURCE_TYPES.FOLDER, { folderPath: remotePath });
                    return;
                }

                if (thumbnail === "true" && THUMB_EXTS.has(getExt(remotePath)) && stats.size <= 10 * 1024 * 1024) {
                    res.header("Content-Type", "image/jpeg");
                    res.header("Cache-Control", "public, max-age=3600");
                    const rs = sftp.createReadStream(remotePath);
                    const tf = sharp().resize(thumbSize, thumbSize, { fit: "cover" }).jpeg({ quality: 80 });
                    streams.push(rs, tf);
                    rs.on("error", () => { cleanupAll(); handleError(res, { message: "Read error" }); });
                    tf.on("end", cleanupAll);
                    rs.pipe(tf).pipe(res);
                    return;
                }

                res.header("Content-Disposition", `${preview === "true" ? "inline" : "attachment"}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
                res.header("Content-Length", stats.size);
                const ext = getExt(remotePath);
                if (MIME_TYPES[ext]) res.header("Content-Type", MIME_TYPES[ext]);

                const rs = sftp.createReadStream(remotePath);
                streams.push(rs);
                rs.on("error", () => { cleanupAll(); handleError(res, { message: "Read error" }); });
                rs.on("end", cleanupAll);
                rs.pipe(res);

                audit(v, req, AUDIT_ACTIONS.FILE_DOWNLOAD, RESOURCE_TYPES.FILE, { filePath: remotePath, fileSize: stats.size });
            } catch (err) {
                cleanupAll();
                handleError(res, err);
            }
        });
    } catch (err) {
        cleanupAll();
        handleError(res, err);
    }
});

module.exports = app;
