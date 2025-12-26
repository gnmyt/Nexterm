const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const AuditLog = require("../models/AuditLog");
const { isRecordingEnabled, getRecordingPath, compressRecording, finalizeGuacRecording } = require("../utils/recordingService");

class SessionManager {
    constructor() {
        if (SessionManager.instance) {
            return SessionManager.instance;
        }
        this.sessions = new Map();
        this.shareIndex = new Map();
        SessionManager.instance = this;
    }

    static MAX_LOG_BUFFER_SIZE = 200 * 1024; // 200KB

    create(accountId, entryId, configuration, connectionReason = null, tabId = null, browserId = null, auditLogId = null) {
        const sessionId = uuidv4();
        const session = {
            sessionId,
            accountId,
            entryId,
            configuration,
            connectionReason,
            tabId,
            browserId,
            auditLogId,
            isHibernated: false,
            createdAt: new Date(),
            lastActivity: new Date(),
            masterConnection: null,
            masterConnectionPending: false,
            logBuffer: "",
            activeWs: null,
            connectedWs: new Set(),
            sharedWs: new Set(),
            shareId: null,
            shareWritable: false,
        };
        this.sessions.set(sessionId, session);
        logger.info(`Session created`, { sessionId, accountId, entryId });
        return session;
    }

    get(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    getAll(accountId, tabId = undefined, browserId = undefined) {
        const results = [];
        for (const session of this.sessions.values()) {
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
    }

    setMasterConnection(sessionId, connection) {
        const session = this.get(sessionId);
        if (!session) return false;
        if (session.masterConnection) {
            logger.warn(`Session already has master connection`, { sessionId });
            return false;
        }
        session.masterConnection = connection;
        session.masterConnectionPending = false;
        return true;
    }

    getMasterConnection(sessionId) {
        return this.get(sessionId)?.masterConnection || null;
    }

    updateMasterConnectionId(sessionId, connectionId) {
        const session = this.get(sessionId);
        if (session?.masterConnection) {
            session.masterConnection.guacdConnectionId = connectionId;
        }
    }

    hasMasterConnection(sessionId) {
        const session = this.get(sessionId);
        if (!session) return false;
        return session.masterConnection?.guacdClient || session.masterConnectionPending;
    }

    setMasterConnectionPending(sessionId) {
        const session = this.get(sessionId);
        if (!session) return false;
        if (session.masterConnection || session.masterConnectionPending) return false;
        session.masterConnectionPending = true;
        return true;
    }

    onMasterConnectionClosed(sessionId, reason = 'closed') {
        const session = this.get(sessionId);
        if (!session) return;
        logger.info(`Master connection ${reason}, terminating session`, { sessionId });
        this.remove(sessionId);
    }

    async initRecording(sessionId, organizationId, cols = 80, rows = 24) {
        const session = this.get(sessionId);
        if (!session || !session.auditLogId) return false;
        
        const enabled = await isRecordingEnabled(organizationId);
        if (!enabled) return false;

        const castPath = getRecordingPath(session.auditLogId, "cast", false);
        const stream = fs.createWriteStream(castPath, { flags: "w" });
        const startTime = Date.now();
        
        stream.write(JSON.stringify({ version: 2, width: cols, height: rows, timestamp: Math.floor(startTime / 1000), env: { SHELL: "/bin/bash", TERM: "xterm-256color" } }) + "\n");
        
        session.recording = { stream, startTime, path: castPath, cols, rows };
        return true;
    }

    recordResize(sessionId, cols, rows) {
        const session = this.get(sessionId);
        if (!session?.recording?.stream) return;
        if (session.recording.cols === cols && session.recording.rows === rows) return;
        
        session.recording.cols = cols;
        session.recording.rows = rows;
        const elapsed = (Date.now() - session.recording.startTime) / 1000;
        session.recording.stream.write(JSON.stringify([elapsed, "r", `${cols}x${rows}`]) + "\n");
    }

    appendLog(sessionId, data) {
        const session = this.get(sessionId);
        if (!session) return;
        session.logBuffer += data;
        if (session.logBuffer.length > SessionManager.MAX_LOG_BUFFER_SIZE) {
            session.logBuffer = session.logBuffer.slice(-SessionManager.MAX_LOG_BUFFER_SIZE);
        }
        if (session.recording?.stream) {
            const elapsed = (Date.now() - session.recording.startTime) / 1000;
            session.recording.stream.write(JSON.stringify([elapsed, "o", data]) + "\n");
        }
    }

    async finalizeTerminalRecording(sessionId) {
        const session = this.get(sessionId);
        if (!session?.recording?.stream) return;
        
        const { stream, path } = session.recording;
        const auditLogId = session.auditLogId;
        session.recording = null;
        
        try {
            stream.end();
            await new Promise(resolve => stream.on("finish", resolve));
            await compressRecording(path, getRecordingPath(auditLogId, "cast", true));
            await this.markRecordingComplete(auditLogId, "cast");
        } catch (error) {
            logger.error("Failed to finalize terminal recording", { sessionId, error: error.message });
        }
    }

    getLogBuffer(sessionId) {
        return this.get(sessionId)?.logBuffer || "";
    }

    setActiveWs(sessionId, ws) {
        const session = this.get(sessionId);
        if (session) session.activeWs = ws;
    }

    isActiveWs(sessionId, ws) {
        return this.get(sessionId)?.activeWs === ws;
    }

    addWebSocket(sessionId, ws, isShared = false) {
        const session = this.get(sessionId);
        if (!session) return;
        if (isShared) session.sharedWs.add(ws);
        else session.connectedWs.add(ws);
    }

    removeWebSocket(sessionId, ws, isShared = false) {
        const session = this.get(sessionId);
        if (!session) return;
        if (isShared) session.sharedWs.delete(ws);
        else session.connectedWs.delete(ws);
        if (session.activeWs === ws) session.activeWs = null;
    }

    closeAllWebSockets(sessionId, code = 1000, reason = "Session terminated") {
        const session = this.get(sessionId);
        if (!session) return;
        for (const ws of session.connectedWs) {
            try { if (ws.readyState <= 1) ws.close(code, reason); } catch (e) {}
        }
        for (const ws of session.sharedWs) {
            try { if (ws.readyState <= 1) ws.close(4016, reason); } catch (e) {}
        }
        session.connectedWs.clear();
        session.sharedWs.clear();
        session.activeWs = null;
    }

    hibernate(sessionId) {
        const session = this.get(sessionId);
        if (!session) return false;
        session.isHibernated = true;
        session.lastActivity = new Date();
        logger.info(`Session hibernated`, { sessionId });
        return true;
    }

    resume(sessionId, tabId = null, browserId = null) {
        const session = this.get(sessionId);
        if (!session) return false;
        session.isHibernated = false;
        session.lastActivity = new Date();
        if (tabId !== null) session.tabId = tabId;
        if (browserId !== null) session.browserId = browserId;
        logger.info(`Session resumed`, { sessionId });
        return true;
    }

    async remove(sessionId) {
        const session = this.get(sessionId);
        if (!session) return false;

        this.closeAllWebSockets(sessionId);

        if (session.recording) {
            await this.finalizeTerminalRecording(sessionId);
        }

        if (session.masterConnection) {
            const conn = session.masterConnection;
            
            if (conn.recordingEnabled && conn.auditLogId) {
                this.finalizeGuacRecording(conn.auditLogId);
            }
            
            if (conn.guacdConnection) {
                try { conn.guacdConnection.removeAllListeners(); } catch (e) {}
                try { conn.guacdConnection.end(); } catch (e) {}
                try { conn.guacdConnection.destroy(); } catch (e) {}
            }
            if (conn.keepAliveInterval) {
                try { clearInterval(conn.keepAliveInterval); } catch (e) {}
            }
            if (conn.stream) {
                try { conn.stream.close(); } catch (e) {}
                try { conn.stream.destroy(); } catch (e) {}
            }
            if (conn.ssh) {
                try { conn.ssh.end(); } catch (e) {}
            }
            if (conn.socket) {
                try { conn.socket.end(); } catch (e) {}
                try { conn.socket.destroy(); } catch (e) {}
            }
            if (conn.lxcSocket) {
                try { conn.lxcSocket.close(); } catch (e) {}
            }
            session.masterConnection = null;
        }

        if (session.shareId) {
            this.shareIndex.delete(session.shareId);
        }

        this.sessions.delete(sessionId);
        logger.info(`Session removed`, { sessionId });
        return true;
    }

    async finalizeGuacRecording(auditLogId) {
        try {
            const success = await finalizeGuacRecording(auditLogId);
            if (success) {
                await this.markRecordingComplete(auditLogId, "guac");
            }
        } catch (error) {
            logger.error("Failed to finalize guac recording", { auditLogId, error: error.message });
        }
    }

    async markRecordingComplete(auditLogId, recordingType) {
        try {
            if (!auditLogId) return;
            
            const auditLog = await AuditLog.findByPk(auditLogId);
            if (!auditLog) return;

            const currentDetails = typeof auditLog.details === "string" 
                ? JSON.parse(auditLog.details) 
                : auditLog.details || {};
            
            currentDetails.hasRecording = true;
            currentDetails.recordingType = recordingType;

            await AuditLog.update(
                { details: currentDetails }, 
                { where: { id: auditLogId } }
            );
            
            logger.debug("Marked recording complete", { auditLogId, recordingType });
        } catch (error) {
            logger.error("Failed to mark recording complete", { auditLogId, error: error.message });
        }
    }

    updateActivity(sessionId) {
        const session = this.get(sessionId);
        if (session) session.lastActivity = new Date();
    }

    startSharing(sessionId, writable = false) {
        const session = this.get(sessionId);
        if (!session) return null;
        if (session.shareId) return session.shareId;
        const shareId = uuidv4().replace(/-/g, "").substring(0, 16);
        session.shareId = shareId;
        session.shareWritable = writable;
        this.shareIndex.set(shareId, sessionId);
        logger.info(`Session sharing started`, { sessionId, shareId, writable });
        return shareId;
    }

    stopSharing(sessionId) {
        const session = this.get(sessionId);
        if (!session?.shareId) return false;
        this.shareIndex.delete(session.shareId);
        for (const ws of session.sharedWs) {
            if (session.activeWs === ws) session.activeWs = null;
            try { ws.close(4016, "Sharing stopped"); } catch (e) {}
        }
        session.sharedWs.clear();
        session.shareId = null;
        session.shareWritable = false;
        logger.info(`Session sharing stopped`, { sessionId });
        return true;
    }

    updateSharePermissions(sessionId, writable) {
        const session = this.get(sessionId);
        if (!session?.shareId) return false;
        session.shareWritable = writable;
        return true;
    }

    getByShareId(shareId) {
        const sessionId = this.shareIndex.get(shareId);
        return sessionId ? this.get(sessionId) : null;
    }

    setConnection(sessionId, connection) {
        return this.setMasterConnection(sessionId, connection);
    }

    getConnection(sessionId) {
        return this.getMasterConnection(sessionId);
    }

    setConnectingPromise(sessionId, promise) {
        const session = this.get(sessionId);
        if (session) session.connectingPromise = promise;
    }

    getConnectingPromise(sessionId) {
        return this.get(sessionId)?.connectingPromise || null;
    }

    cleanupOldSessions() {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        let removed = 0;
        for (const [sessionId, session] of this.sessions) {
            if (!session.isHibernated && new Date(session.lastActivity) < sixHoursAgo) {
                logger.info("Removing old session", { sessionId });
                this.remove(sessionId);
                removed++;
            }
        }
        return removed;
    }

    startCleanupInterval() {
        setInterval(() => {
            const removed = this.cleanupOldSessions();
            if (removed > 0) logger.info(`Cleaned up ${removed} old sessions`);
        }, 30 * 60 * 1000);
    }
}

const instance = new SessionManager();
instance.startCleanupInterval();
module.exports = instance;
