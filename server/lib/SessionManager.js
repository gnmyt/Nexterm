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
            connection: null
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
        if (session && session.connection) {
            if (typeof session.connection.end === 'function') {
                session.connection.end();
            } else if (typeof session.connection.close === 'function') {
                session.connection.close();
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
