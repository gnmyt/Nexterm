const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class SessionManager {
    constructor() {
        if (SessionManager.instance) {
            return SessionManager.instance;
        }
        this.sessions = [];
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
            connection: null,
            connectingPromise: null,
            logBuffer: '',
            activeWs: null,
            connectedWs: new Set()
        };
        this.sessions.push(session);
        logger.info(`Session created`, { sessionId, accountId, entryId, tabId, browserId, auditLogId });
        return session;
    }

    get(sessionId) {
        return this.sessions.find(s => s.sessionId === sessionId);
    }

    getAll(accountId, tabId = undefined, browserId = undefined) {
        const filtered = this.sessions.filter(s => {
            if (s.accountId !== accountId) return false;
            if (s.isHibernated) return true;
            if (tabId !== undefined && s.tabId !== tabId) return false;
            if (browserId !== undefined && s.browserId !== browserId) return false;
            return true;
        });
        logger.info(`Getting sessions`, { 
            accountId, 
            tabId, 
            browserId, 
            totalSessions: this.sessions.length, 
            accountSessions: this.sessions.filter(s => s.accountId === accountId).length,
            filteredCount: filtered.length,
            sessionTabIds: this.sessions.filter(s => s.accountId === accountId).map(s => s.tabId),
            sessionBrowserIds: this.sessions.filter(s => s.accountId === accountId).map(s => s.browserId)
        });
        return filtered;
    }

    setConnection(sessionId, connection) {
        const session = this.get(sessionId);
        if (session) {
            session.connection = connection;
        }
    }

    getConnection(sessionId) {
        const session = this.get(sessionId);
        return session ? session.connection : null;
    }

    setConnectingPromise(sessionId, promise) {
        const session = this.get(sessionId);
        if (session) {
            session.connectingPromise = promise;
        }
    }

    getConnectingPromise(sessionId) {
        const session = this.get(sessionId);
        return session ? session.connectingPromise : null;
    }

    appendLog(sessionId, data) {
        const session = this.get(sessionId);
        if (session) {
            session.logBuffer += data;
            if (session.logBuffer.length > SessionManager.MAX_LOG_BUFFER_SIZE) {
                session.logBuffer = session.logBuffer.slice(-SessionManager.MAX_LOG_BUFFER_SIZE);
            }
        }
    }

    getLogBuffer(sessionId) {
        const session = this.get(sessionId);
        return session ? session.logBuffer : '';
    }

    setActiveWs(sessionId, ws) {
        const session = this.get(sessionId);
        if (session) session.activeWs = ws;
    }

    isActiveWs(sessionId, ws) {
        const session = this.get(sessionId);
        return session && session.activeWs === ws;
    }

    addWebSocket(sessionId, ws) {
        const session = this.get(sessionId);
        if (session) session.connectedWs.add(ws);
    }

    removeWebSocket(sessionId, ws) {
        const session = this.get(sessionId);
        if (session) {
            session.connectedWs.delete(ws);
            if (session.activeWs === ws) session.activeWs = null;
        }
    }

    closeAllWebSockets(sessionId) {
        const session = this.get(sessionId);
        if (session) {
            for (const ws of session.connectedWs) {
                try {
                    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
                        ws.close(1000, 'Session terminated');
                    }
                } catch (e) {}
            }
            session.connectedWs.clear();
            session.activeWs = null;
        }
    }

    hibernate(sessionId) {
        const session = this.get(sessionId);
        if (session) {
            session.isHibernated = true;
            session.lastActivity = new Date();
            logger.info(`Session hibernated`, { sessionId });
            return true;
        }
        return false;
    }

    resume(sessionId, tabId = null, browserId = null) {
        const session = this.get(sessionId);
        if (session) {
            session.isHibernated = false;
            session.lastActivity = new Date();
            if (tabId !== null) session.tabId = tabId;
            if (browserId !== null) session.browserId = browserId;
            logger.info(`Session resumed`, { sessionId, tabId, browserId });
            return true;
        }
        return false;
    }

    remove(sessionId) {
        const session = this.get(sessionId);
        if (session) {
            this.closeAllWebSockets(sessionId);
            
            if (session.connection) {
                const conn = session.connection;
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
                if (conn.keepAliveTimer) {
                    try { clearInterval(conn.keepAliveTimer); } catch (e) {}
                }
                if (conn.guacdClient) {
                    try { conn.guacdClient.close(); } catch (e) {}
                }
                if (conn.clientConnection) {
                    try { conn.clientConnection.destroy(); } catch (e) {}
                }
                if (typeof conn.end === 'function') {
                    try { conn.end(); } catch (e) {}
                } else if (typeof conn.close === 'function') {
                    try { conn.close(); } catch (e) {}
                }
            }
        }

        const initialLength = this.sessions.length;
        this.sessions = this.sessions.filter(s => s.sessionId !== sessionId);
        const removed = this.sessions.length < initialLength;
        if (removed) {
            logger.info(`Session removed`, { sessionId });
        }
        return removed;
    }

    updateActivity(sessionId) {
        const session = this.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }

    cleanupOldSessions() {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const sessionsToRemove = this.sessions.filter(
            s => !s.isHibernated && new Date(s.lastActivity) < sixHoursAgo
        );
        sessionsToRemove.forEach(s => {
            logger.info('Removing old session', { 
                sessionId: s.sessionId, 
                accountId: s.accountId, 
                lastActivity: s.lastActivity 
            });
            this.remove(s.sessionId);
        });
        return sessionsToRemove.length;
    }

    startCleanupInterval() {
        setInterval(() => {
            const removed = this.cleanupOldSessions();
            if (removed > 0) {
                logger.info(`Cleaned up ${removed} old sessions`);
            }
        }, 30 * 60 * 1000);
    }
}

const instance = new SessionManager();
instance.startCleanupInterval();
module.exports = instance;
