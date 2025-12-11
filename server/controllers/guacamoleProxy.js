const ClientConnection = require('../lib/ClientConnection.js');
const logger = require('../utils/logger');
const SessionManager = require("../lib/SessionManager");

module.exports = async (ws, settings) => {
    try {
        this.clientOptions = {
            maxInactivityTime: 10000,

            connectionDefaultSettings: {
                rdp: { 'args': 'connect', 'port': '3389', 'width': 1024, 'height': 768, 'dpi': 96, },
                vnc: { 'args': 'connect', 'port': '5900', 'width': 1024, 'height': 768, 'dpi': 96, },
            }
        };

        const { serverSession } = settings;
        let existingConnection = null;
        if (serverSession) existingConnection = SessionManager.getConnection(serverSession.sessionId);

        if (existingConnection && existingConnection.guacdClient && existingConnection.guacdClient.guacdConnectionId) {
            const connectionId = existingConnection.guacdClient.guacdConnectionId;
            new ClientConnection(ws, this.clientOptions, settings, connectionId);
        } else {
            new ClientConnection(ws, this.clientOptions, settings);
        }

    } catch (error) {
        logger.error("Error in guacamoleProxy", { error: error.message, stack: error.stack });
        ws.close(1011, "Internal server error");
    }
}