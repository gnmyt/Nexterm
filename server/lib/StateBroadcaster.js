const OrganizationMember = require("../models/OrganizationMember");
const logger = require("../utils/logger");

const STATE_TYPES = { ENTRIES: "ENTRIES", IDENTITIES: "IDENTITIES", SNIPPETS: "SNIPPETS", CONNECTIONS: "CONNECTIONS", LOGOUT: "LOGOUT" };
const BROADCASTABLE_TYPES = [STATE_TYPES.ENTRIES, STATE_TYPES.IDENTITIES, STATE_TYPES.SNIPPETS, STATE_TYPES.CONNECTIONS];

class StateBroadcaster {
    constructor() {
        this.connections = new Map();
        this.sessionIndex = new Map();
        this.pendingBroadcasts = new Map();
        this.debounceDelay = 100;
    }

    register(accountId, sessionId, ws, tabId = null, browserId = null) {
        if (!this.connections.has(accountId)) this.connections.set(accountId, new Set());
        const conn = { ws, tabId, browserId, sessionId };
        this.connections.get(accountId).add(conn);
        if (!this.sessionIndex.has(sessionId)) this.sessionIndex.set(sessionId, new Set());
        this.sessionIndex.get(sessionId).add(conn);
    }

    unregister(accountId, ws) {
        const conns = this.connections.get(accountId);
        if (conns) {
            for (const conn of conns) {
                if (conn.ws === ws) {
                    conns.delete(conn);
                    const sessionConns = this.sessionIndex.get(conn.sessionId);
                    if (sessionConns) {
                        sessionConns.delete(conn);
                        if (sessionConns.size === 0) this.sessionIndex.delete(conn.sessionId);
                    }
                    break;
                }
            }
            if (conns.size === 0) this.connections.delete(accountId);
        }
    }

    async getStateData(stateType, accountId, tabId = null, browserId = null) {
        switch (stateType) {
            case STATE_TYPES.ENTRIES:
                return require("../controllers/entry").listEntries(accountId);
            case STATE_TYPES.IDENTITIES:
                return require("../controllers/identity").listIdentities(accountId);
            case STATE_TYPES.SNIPPETS:
                const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
                return require("../controllers/snippet").listAllAccessibleSnippets(accountId, memberships.map(m => m.organizationId));
            case STATE_TYPES.CONNECTIONS:
                return require("../controllers/serverSession").getSessions(accountId, tabId, browserId);
            default:
                return null;
        }
    }

    async sendStateToConnection(accountId, conn, stateType) {
        if (conn.ws.readyState !== 1) return;
        try {
            const data = await this.getStateData(stateType, accountId, conn.tabId, conn.browserId);
            conn.ws.send(JSON.stringify({ type: stateType, data }));
        } catch (error) {
            logger.error(`StateBroadcaster: failed to send ${stateType}`, { accountId, error: error.message });
        }
    }

    async sendStateToAccount(accountId, stateType) {
        const conns = this.connections.get(accountId);
        if (!conns?.size) return;
        for (const conn of conns) await this.sendStateToConnection(accountId, conn, stateType);
    }

    async sendAllStateToConnection(accountId, conn) {
        for (const type of BROADCASTABLE_TYPES) await this.sendStateToConnection(accountId, conn, type);
    }

    async sendAllStateToAccount(accountId) {
        const conns = this.connections.get(accountId);
        if (!conns?.size) return;
        for (const conn of conns) await this.sendAllStateToConnection(accountId, conn);
    }

    broadcast(stateType, { accountId, organizationId } = {}) {
        this.resolveAffectedAccounts(accountId, organizationId).then(ids => {
            ids.forEach(id => this.scheduleBroadcast(id, stateType));
        });
    }

    async resolveAffectedAccounts(accountId, organizationId) {
        const affected = new Set();
        if (accountId) affected.add(accountId);
        if (organizationId) {
            const members = await OrganizationMember.findAll({ where: { organizationId, status: "active" } });
            members.forEach(m => affected.add(m.accountId));
        }
        return [...affected].filter(id => this.connections.has(id));
    }

    scheduleBroadcast(accountId, stateType) {
        const key = `${accountId}:${stateType}`;
        if (this.pendingBroadcasts.has(key)) clearTimeout(this.pendingBroadcasts.get(key));
        this.pendingBroadcasts.set(key, setTimeout(() => {
            this.pendingBroadcasts.delete(key);
            this.sendStateToAccount(accountId, stateType);
        }, this.debounceDelay));
    }

    forceLogout(accountId) {
        const numericId = Number(accountId);
        const conns = this.connections.get(numericId);
        if (!conns?.size) return;
        for (const conn of conns) {
            if (conn.ws.readyState === 1) {
                try {
                    conn.ws.send(JSON.stringify({ type: STATE_TYPES.LOGOUT, data: { reason: "session_invalidated" } }));
                    conn.ws.close(4010, "Session invalidated");
                } catch (e) {
                    logger.error(`StateBroadcaster: failed to send LOGOUT`, { accountId, error: e.message });
                }
            }
            if (conn.sessionId) {
                const sessionConns = this.sessionIndex.get(conn.sessionId);
                if (sessionConns) sessionConns.delete(conn);
                if (!sessionConns?.size) this.sessionIndex.delete(conn.sessionId);
            }
        }
        this.connections.delete(numericId);
        logger.info(`StateBroadcaster: forced logout for account`, { accountId: numericId });
    }

    forceLogoutSession(sessionId) {
        const conns = this.sessionIndex.get(sessionId);
        if (!conns?.size) return;
        for (const conn of conns) {
            if (conn.ws.readyState === 1) {
                try {
                    conn.ws.send(JSON.stringify({ type: STATE_TYPES.LOGOUT, data: { reason: "session_invalidated" } }));
                    conn.ws.close(4010, "Session invalidated");
                } catch (e) {
                    logger.error(`StateBroadcaster: failed to send LOGOUT`, { sessionId, error: e.message });
                }
            }
        }
        this.sessionIndex.delete(sessionId);
        logger.info(`StateBroadcaster: forced logout for session`, { sessionId });
    }
}

module.exports = new StateBroadcaster();
module.exports.STATE_TYPES = STATE_TYPES;
