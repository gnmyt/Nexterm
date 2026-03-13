const fs = require("node:fs");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const AuditLog = require("../models/AuditLog");
const { isRecordingEnabled, getRecordingPath, compressRecording, finalizeGuacRecording } = require("../utils/recordingService");
const stateBroadcaster = require("./StateBroadcaster");

const MAX_LOG_BUFFER_SIZE = 200 * 1024;
const sessions = new Map();
const shareIndex = new Map();
const CONTROL_PLANE_TYPES = new Set(["ssh", "sftp", "guac"]);

module.exports.create = (accountId, entryId, configuration, connectionReason = null, tabId = null, browserId = null, auditLogId = null) => {
    const sessionId = uuidv4();
    const session = {
        sessionId, accountId, entryId, configuration, connectionReason,
        tabId, browserId, auditLogId,
        isHibernated: false,
        createdAt: new Date(),
        lastActivity: new Date(),
        masterConnection: null,
        logBuffer: "",
        activeWs: null,
        connectedWs: new Set(),
        sharedWs: new Set(),
        shareId: null,
        shareWritable: false,
    };
    sessions.set(sessionId, session);
    logger.info(`Session created`, { sessionId, accountId, entryId });
    return session;
};

module.exports.get = (sessionId) => sessions.get(sessionId) || null;

module.exports.getAll = (accountId, tabId = undefined, browserId = undefined) => {
    const results = [];
    for (const session of sessions.values()) {
        if (session.accountId !== accountId) continue;
        if (session.isHibernated) {
            results.push(session);
            continue;
        }
        if (tabId !== undefined && session.tabId !== tabId) continue;
        if (browserId !== undefined && session.browserId !== browserId) continue;
        results.push(session);
    }
    return results;
};

module.exports.setConnection = (sessionId, connection) => {
    const session = module.exports.get(sessionId);
    if (!session) return false;
    if (session.masterConnection) {
        logger.warn(`Session already has master connection`, { sessionId });
        return false;
    }
    session.masterConnection = connection;
    return true;
};

module.exports.getConnection = (sessionId) => module.exports.get(sessionId)?.masterConnection || null;

module.exports.updateConnectionId = (sessionId, connectionId) => {
    const session = module.exports.get(sessionId);
    if (session?.masterConnection) {
        session.masterConnection.guacdConnectionId = connectionId;
    }
};

module.exports.onMasterConnectionClosed = (sessionId, reason = "closed") => {
    const session = module.exports.get(sessionId);
    if (!session) return;
    logger.info(`Master connection ${reason}, terminating session`, { sessionId });
    module.exports.remove(sessionId);
};

module.exports.initRecording = async (sessionId, organizationId, cols = 80, rows = 24) => {
    const session = module.exports.get(sessionId);
    if (!session?.auditLogId) return false;

    const enabled = await isRecordingEnabled(organizationId);
    if (!enabled) return false;

    const castPath = getRecordingPath(session.auditLogId, "cast", false);
    const stream = fs.createWriteStream(castPath, { flags: "w" });
    const startTime = Date.now();
    stream.write(JSON.stringify({ version: 2, width: cols, height: rows, timestamp: Math.floor(startTime / 1000), env: { SHELL: "/bin/bash", TERM: "xterm-256color" } }) + "\n");
    session.recording = { stream, startTime, path: castPath, cols, rows };
    logger.info("Recording started", { sessionId, auditLogId: session.auditLogId });
    return true;
};

module.exports.recordResize = (sessionId, cols, rows) => {
    const rec = module.exports.get(sessionId)?.recording;
    if (!rec?.stream || (rec.cols === cols && rec.rows === rows)) return;
    rec.cols = cols;
    rec.rows = rows;
    rec.stream.write(JSON.stringify([(Date.now() - rec.startTime) / 1000, "r", `${cols}x${rows}`]) + "\n");
};

module.exports.appendLog = (sessionId, data) => {
    const session = module.exports.get(sessionId);
    if (!session) return;
    session.logBuffer += data;
    if (session.logBuffer.length > MAX_LOG_BUFFER_SIZE) {
        session.logBuffer = session.logBuffer.slice(-MAX_LOG_BUFFER_SIZE);
    }
    session.recording?.stream?.write(JSON.stringify([(Date.now() - session.recording.startTime) / 1000, "o", data]) + "\n");
};

const markRecordingComplete = async (auditLogId, recordingType) => {
    if (!auditLogId) return;
    const log = await AuditLog.findByPk(auditLogId);
    if (!log) return;
    const details = log.details || {};
    await AuditLog.update({ details: { ...details, hasRecording: true, recordingType } }, { where: { id: auditLogId } });
};

const finalizeTerminalRecording = async (sessionId) => {
    const rec = module.exports.get(sessionId)?.recording;
    if (!rec?.stream) return;
    const { stream, path } = rec;
    const auditLogId = module.exports.get(sessionId).auditLogId;
    module.exports.get(sessionId).recording = null;
    stream.end();
    await new Promise(r => stream.on("finish", r));
    await compressRecording(path, getRecordingPath(auditLogId, "cast", true));
    await markRecordingComplete(auditLogId, "cast");
};

const finalizeGuacRecordingForSession = async (auditLogId) => {
    if (await finalizeGuacRecording(auditLogId)) {
        await markRecordingComplete(auditLogId, "guac");
    }
};

module.exports.getLogBuffer = (sessionId) => module.exports.get(sessionId)?.logBuffer || "";

module.exports.setActiveWs = (sessionId, ws) => {
    const session = module.exports.get(sessionId);
    if (session) session.activeWs = ws;
};

module.exports.isActiveWs = (sessionId, ws) => module.exports.get(sessionId)?.activeWs === ws;

module.exports.addWebSocket = (sessionId, ws, isShared = false) => {
    const session = module.exports.get(sessionId);
    if (!session) return;
    if (isShared) session.sharedWs.add(ws);
    else session.connectedWs.add(ws);
};

module.exports.removeWebSocket = (sessionId, ws, isShared = false) => {
    const session = module.exports.get(sessionId);
    if (!session) return;
    if (isShared) session.sharedWs.delete(ws);
    else session.connectedWs.delete(ws);
    if (session.activeWs === ws) session.activeWs = null;
};

const closeAllWebSockets = (sessionId, code = 1000, reason = "Session terminated") => {
    const session = module.exports.get(sessionId);
    if (!session) return;
    for (const ws of session.connectedWs) {
        try { if (ws.readyState <= 1) ws.close(code, reason); } catch {}
    }
    for (const ws of session.sharedWs) {
        try { if (ws.readyState <= 1) ws.close(4016, reason); } catch {}
    }
    session.connectedWs.clear();
    session.sharedWs.clear();
    session.activeWs = null;
};

module.exports.hibernate = (sessionId) => {
    const session = module.exports.get(sessionId);
    if (!session) return false;
    session.isHibernated = true;
    session.lastActivity = new Date();
    logger.info(`Session hibernated`, { sessionId });
    return true;
};

module.exports.resume = (sessionId, tabId = null, browserId = null) => {
    const session = module.exports.get(sessionId);
    if (!session) return false;
    session.isHibernated = false;
    session.lastActivity = new Date();
    if (tabId !== null) session.tabId = tabId;
    if (browserId !== null) session.browserId = browserId;
    logger.info(`Session resumed`, { sessionId });
    return true;
};

const cleanupConnection = async (conn, sessionId) => {
    if (conn.recordingEnabled && conn.auditLogId) {
        await finalizeGuacRecordingForSession(conn.auditLogId);
    }
    if (CONTROL_PLANE_TYPES.has(conn.type)) {
        try { require("./controlPlane/ControlPlaneServer").closeSession(sessionId); } catch {}
    }
    for (const s of [conn.dataSocket, conn.socket]) {
        if (!s) continue;
        try { s.removeAllListeners(); } catch {}
        try { s.end(); } catch {}
        try { s.destroy(); } catch {}
    }
    if (conn.keepAliveTimer) clearInterval(conn.keepAliveTimer);
    try { conn.guacdClient?.close(); } catch {}
    try { conn.sftpClient?.close(); } catch {}
    try { conn.lxcSocket?.close(); } catch {}
};

module.exports.remove = async (sessionId) => {
    const session = module.exports.get(sessionId);
    if (!session) return false;

    closeAllWebSockets(sessionId);
    if (session.recording) await finalizeTerminalRecording(sessionId);
    if (session.masterConnection) {
        await cleanupConnection(session.masterConnection, sessionId);
        session.masterConnection = null;
    }
    if (session.shareId) shareIndex.delete(session.shareId);

    const accountId = session.accountId;
    sessions.delete(sessionId);
    logger.info("Session removed", { sessionId });
    stateBroadcaster.broadcast("CONNECTIONS", { accountId });
    return true;
};

module.exports.updateActivity = (sessionId) => {
    const session = module.exports.get(sessionId);
    if (session) session.lastActivity = new Date();
};

module.exports.startSharing = (sessionId, writable = false) => {
    const session = module.exports.get(sessionId);
    if (!session) return null;
    if (session.shareId) return session.shareId;
    const shareId = uuidv4().replaceAll("-", "").substring(0, 16);
    session.shareId = shareId;
    session.shareWritable = writable;
    shareIndex.set(shareId, sessionId);
    logger.info(`Session sharing started`, { sessionId, shareId, writable });
    return shareId;
};

module.exports.stopSharing = (sessionId) => {
    const session = module.exports.get(sessionId);
    if (!session?.shareId) return false;
    shareIndex.delete(session.shareId);
    for (const ws of session.sharedWs) {
        if (session.activeWs === ws) session.activeWs = null;
        try { ws.close(4016, "Sharing stopped"); } catch {}
    }
    session.sharedWs.clear();
    session.shareId = null;
    session.shareWritable = false;
    logger.info(`Session sharing stopped`, { sessionId });
    return true;
};

module.exports.updateSharePermissions = (sessionId, writable) => {
    const session = module.exports.get(sessionId);
    if (!session?.shareId) return false;
    session.shareWritable = writable;
    return true;
};

module.exports.getByShareId = (shareId) => {
    const sessionId = shareIndex.get(shareId);
    return sessionId ? module.exports.get(sessionId) : null;
};

module.exports.removeAllByAccountId = async (accountId) => {
    const numericId = Number(accountId);
    const toRemove = [...sessions.entries()].filter(([, s]) => s.accountId === numericId).map(([id]) => id);
    for (const id of toRemove) await module.exports.remove(id);
    logger.info(`Removed all sessions for account`, { accountId, count: toRemove.length });
    return toRemove.length;
};

module.exports.removeAllByEntryId = async (entryId) => {
    const numericId = Number(entryId);
    const toRemove = [...sessions.entries()].filter(([, s]) => s.entryId === numericId).map(([id]) => id);
    for (const id of toRemove) await module.exports.remove(id);
    if (toRemove.length > 0) {
        logger.info(`Removed all sessions for entry`, { entryId, count: toRemove.length });
    }
    return toRemove.length;
};

setInterval(() => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    let removed = 0;
    for (const [sessionId, session] of sessions) {
        if (!session.isHibernated && new Date(session.lastActivity) < sixHoursAgo) {
            logger.info("Removing old session", { sessionId });
            module.exports.remove(sessionId);
            removed++;
        }
    }
    if (removed > 0) logger.info(`Cleaned up ${removed} old sessions`);
}, 30 * 60 * 1000);
