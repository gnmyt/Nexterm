const OrganizationMember = require("../models/OrganizationMember");
const logger = require("../utils/logger");

const STATE_TYPES = { ENTRIES: "ENTRIES", IDENTITIES: "IDENTITIES", SNIPPETS: "SNIPPETS", CONNECTIONS: "CONNECTIONS", PREFERENCES: "PREFERENCES" };

class StateBroadcaster {
    constructor() {
        this.connections = new Map();
        this.pendingBroadcasts = new Map();
        this.debounceDelay = 100;
    }

    register(accountId, ws, tabId = null, browserId = null) {
        if (!this.connections.has(accountId)) this.connections.set(accountId, new Set());
        this.connections.get(accountId).add({ ws, tabId, browserId });
    }

    unregister(accountId, ws) {
        const conns = this.connections.get(accountId);
        if (conns) {
            for (const conn of conns) {
                if (conn.ws === ws) { conns.delete(conn); break; }
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

    broadcastPreferences(accountId, payload, sourceWs = null) {
        const conns = this.connections.get(accountId);
        if (!conns?.size) return;
        for (const conn of conns) {
            try {
                if (conn.ws && conn.ws.readyState === 1 && conn.ws !== sourceWs) {
                    conn.ws.send(JSON.stringify({ type: STATE_TYPES.PREFERENCES, data: payload }));
                }
            } catch (e) {
                logger.error(`StateBroadcaster: failed to broadcast preferences`, { accountId, error: e.message });
            }
        }
    }

    async sendStateToAccount(accountId, stateType) {
        const conns = this.connections.get(accountId);
        if (!conns?.size) return;
        for (const conn of conns) await this.sendStateToConnection(accountId, conn, stateType);
    }

    async sendAllStateToConnection(accountId, conn) {
        for (const type of Object.values(STATE_TYPES)) await this.sendStateToConnection(accountId, conn, type);
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
}

module.exports = new StateBroadcaster();
module.exports.STATE_TYPES = STATE_TYPES;
