/**
 * Copyright 2024 Vadim Pronin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified by Mathias Wagner, 2025
 */

const GuacdClient = require("./GuacdClient.js");
const { updateAuditLogWithSessionDuration } = require("../controllers/audit");
const SessionManager = require("./SessionManager");
const logger = require("../utils/logger");

class ClientConnection {
    constructor(webSocket, clientOptions, settings) {
        this.webSocket = webSocket;
        this.clientOptions = clientOptions;
        this.connectionSettings = settings;
        this.sessionId = settings.serverSession?.sessionId || null;
        this.connectionStartTime = Date.now();
        this.lastActivity = Date.now();
        this.activityCheckInterval = null;
        this.closed = false;
        this.guacdClient = null;

        this.connectionType = settings.connection?.type || 'vnc';

        const defaults = clientOptions.connectionDefaultSettings?.[this.connectionType] || {};
        this.connectionSettings.connection = { 
            type: this.connectionType,
            ...defaults, 
            ...settings.connection?.settings 
        };

        this.initialize();
    }

    initialize() {
        if (!this.sessionId) {
            logger.warn(`ClientConnection without sessionId`);
            this.webSocket.close(4007, "Session required");
            return;
        }

        const session = SessionManager.get(this.sessionId);
        if (!session) {
            logger.warn(`Session not found`, { sessionId: this.sessionId });
            this.webSocket.close(4007, "Session not found");
            return;
        }

        if (SessionManager.hasMasterConnection(this.sessionId)) {
            this.joinMasterConnection();
        } else if (SessionManager.setMasterConnectionPending(this.sessionId)) {
            this.createMasterConnection();
        } else {
            this.waitAndJoinMaster();
        }
    }

    createMasterConnection() {
        logger.info(`Creating master guacd connection`, { sessionId: this.sessionId, type: this.connectionType });
        
        this.guacdClient = new GuacdClient({
            sessionId: this.sessionId,
            connectionSettings: this.connectionSettings,
            isMaster: true,
            onData: (data) => this.sendToWebSocket(data),
            onReady: (connectionId) => {
                logger.info(`Master connection ready`, { sessionId: this.sessionId, connectionId });
            },
            onClose: () => {
                this.webSocket.removeAllListeners();
                try { this.webSocket.close(); } catch (e) {}
            },
        });
        
        this.guacdClient.connect();

        SessionManager.setMasterConnection(this.sessionId, this.guacdClient.getConnectionInfo());
        SessionManager.addWebSocket(this.sessionId, this.webSocket);
        SessionManager.setActiveWs(this.sessionId, this.webSocket);
        
        this.setupWebSocketHandlers();
    }

    joinMasterConnection() {
        const master = SessionManager.getMasterConnection(this.sessionId);
        const connectionId = master?.guacdConnectionId;
        
        if (!connectionId) {
            this.waitAndJoinMaster();
            return;
        }
        
        logger.info(`Joining master connection`, { sessionId: this.sessionId, connectionId });
        
        this.guacdClient = new GuacdClient({
            sessionId: this.sessionId,
            connectionSettings: this.connectionSettings,
            joinConnectionId: connectionId,
            isMaster: false,
            onData: (data) => this.sendToWebSocket(data),
            onReady: () => {
                logger.info(`Joined master connection successfully`, { sessionId: this.sessionId, connectionId });
            },
            onClose: () => {},
        });
        
        this.guacdClient.connect();

        const session = SessionManager.get(this.sessionId);
        if (session && !session.connectedWs.has(this.webSocket)) {
            SessionManager.addWebSocket(this.sessionId, this.webSocket);
        }
        SessionManager.setActiveWs(this.sessionId, this.webSocket);
        
        this.setupWebSocketHandlers();
    }

    waitAndJoinMaster() {
        SessionManager.addWebSocket(this.sessionId, this.webSocket);
        
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkMaster = () => {
            attempts++;

            if (!SessionManager.get(this.sessionId)) {
                return;
            }
            
            const master = SessionManager.getMasterConnection(this.sessionId);
            
            if (master?.guacdConnectionId) {
                this.joinMasterConnection();
            } else if (attempts >= maxAttempts) {
                logger.warn(`Timeout waiting for master connection`, { sessionId: this.sessionId });
                this.webSocket.close(1000, "Master connection timeout");
            } else {
                setTimeout(checkMaster, 100);
            }
        };
        
        setTimeout(checkMaster, 100);
    }

    sendToWebSocket(data) {
        try {
            if (this.webSocket.readyState === this.webSocket.OPEN) {
                this.webSocket.send(data, { binary: false, mask: false });
            }
        } catch (e) {}
    }

    setupWebSocketHandlers() {
        this.webSocket.on("close", () => this.close());
        this.webSocket.on("error", () => this.close());
        this.webSocket.on("message", (message) => this.onMessage(message));
        
        if (this.clientOptions.maxInactivityTime > 0) {
            this.activityCheckInterval = setInterval(() => {
                if (Date.now() > this.lastActivity + this.clientOptions.maxInactivityTime) {
                    this.close();
                }
            }, 1000);
        }
    }

    onMessage(message) {
        this.lastActivity = Date.now();
        SessionManager.updateActivity(this.sessionId);
        
        const msgStr = message.toString();

        if (this.isInteractionMessage(msgStr)) {
            SessionManager.setActiveWs(this.sessionId, this.webSocket);
        }

        if (msgStr.includes('.size,') && !SessionManager.isActiveWs(this.sessionId, this.webSocket)) {
            return;
        }

        if (this.guacdClient) {
            this.guacdClient.send(message);
        }
    }

    isInteractionMessage(msgStr) {
        if (msgStr.includes('.key,')) return true;
        const mouseMatch = msgStr.match(/\.mouse,\d+\.\d+,\d+\.\d+,(\d+)\.(\d+);/);
        return mouseMatch && parseInt(mouseMatch[2], 10) > 0;
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
        }

        if (this.guacdClient && !this.guacdClient.isMaster) {
            this.guacdClient.close();
            this.guacdClient = null;
        }

        if (this.connectionSettings.auditLogId) {
            updateAuditLogWithSessionDuration(this.connectionSettings.auditLogId, this.connectionStartTime);
        }

        if (this.sessionId) {
            SessionManager.removeWebSocket(this.sessionId, this.webSocket);
        }
        
        this.webSocket.removeAllListeners();
        try {
            if (this.webSocket.readyState <= 1) {
                this.webSocket.close();
            }
        } catch (e) {}
    }
}

module.exports = ClientConnection;
