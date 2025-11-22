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

    create(accountId, entryId, configuration, connectionReason = null) {
        const sessionId = uuidv4();
        const session = {
            sessionId,
            accountId,
            entryId,
            configuration,
            connectionReason,
            isHibernated: false,
            createdAt: new Date(),
            lastActivity: new Date(),
            connection: null
        };
        this.sessions.push(session);
        logger.info(`Session created`, { sessionId, accountId, entryId });
        return session;
    }

    get(sessionId) {
        return this.sessions.find(s => s.sessionId === sessionId);
    }

    getAll(accountId) {
        return this.sessions.filter(s => s.accountId === accountId);
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

    resume(sessionId) {
        const session = this.get(sessionId);
        if (session) {
            session.isHibernated = false;
            session.lastActivity = new Date();
            logger.info(`Session resumed`, { sessionId });
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
}

module.exports = new SessionManager();
