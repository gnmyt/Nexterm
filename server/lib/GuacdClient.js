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

const Net = require('net');
const SessionManager = require('./SessionManager');
const logger = require('../utils/logger');
const { RECORDINGS_DIR } = require('../utils/recordingService');

class GuacdClient {

    constructor(options) {
        this.sessionId = options.sessionId;
        this.connectionSettings = options.connectionSettings || {};
        this.joinConnectionId = options.joinConnectionId || null;
        this.isMaster = options.isMaster !== false;
        this.onDataCallback = options.onData || null;
        this.onReadyCallback = options.onReady || null;
        this.onCloseCallback = options.onClose || null;
        
        this.guacdConnection = null;
        this.guacdConnectionId = null;
        this.connectionType = this.connectionSettings.connection?.type || 'vnc';

        this.recordingEnabled = options.recordingEnabled || false;
        this.auditLogId = options.auditLogId || null;
        
        this.state = 'connecting';
        this.handshakeComplete = false;
        this.receivedBuffer = '';
        
        this.GUAC_AUDIO = this.connectionSettings.enableAudio !== false ? ['audio/L8', 'audio/L16'] : [];
        this.GUAC_VIDEO = [];
        
        this.keepAliveInterval = null;
    }

    connect() {
        this.guacdConnection = Net.connect(4822, '127.0.0.1');
        
        this.guacdConnection.on('connect', () => {
            if (this.joinConnectionId) {
                this.sendOpCode(['select', this.joinConnectionId]);
            } else {
                this.sendOpCode(['select', this.connectionType]);
            }
        });
        
        this.guacdConnection.on('data', (data) => {
            this.receivedBuffer += data;
            
            if (!this.handshakeComplete) {
                if (this.receivedBuffer.indexOf(';') !== -1) {
                    this.completeHandshake();
                }
                return;
            }
            
            this.processData();
        });
        
        this.guacdConnection.on('close', () => {
            this.handleClose('connection closed');
        });
        
        this.guacdConnection.on('error', (error) => {
            this.handleError(error);
        });

        this.keepAliveInterval = setInterval(() => {
            if (this.state === 'open') {
                this.sendOpCode(['nop']);
            }
        }, 5000);
        
        return this;
    }

    completeHandshake() {
        const delimiterPos = this.receivedBuffer.indexOf(';');
        const serverHandshake = this.receivedBuffer.substring(0, delimiterPos);
        this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1);

        const attributes = serverHandshake.split(',');
        const conn = this.connectionSettings.connection || {};

        if (this.recordingEnabled && this.isMaster && this.auditLogId) {
            conn['recording-path'] = RECORDINGS_DIR;
            conn['recording-name'] = String(this.auditLogId);
            conn['create-recording-path'] = 'true';
        }

        this.sendOpCode(['size', conn.width || 1024, conn.height || 768, conn.dpi || 96]);
        this.sendOpCode(['audio'].concat(this.GUAC_AUDIO));
        this.sendOpCode(['video'].concat(this.GUAC_VIDEO));
        this.sendOpCode(['image']);

        const connectionOptions = ['connect'];
        if (this.joinConnectionId) {
            for (let i = 1; i < attributes.length; i++) {
                connectionOptions.push('');
            }
        } else {
            for (let i = 1; i < attributes.length; i++) {
                const attr = attributes[i];
                const name = attr.substring(attr.indexOf('.') + 1);
                connectionOptions.push(conn[name] !== undefined ? conn[name] : '');
            }
        }
        this.sendOpCode(connectionOptions);
        
        this.handshakeComplete = true;
        this.state = 'open';

        this.processData();
    }

    processData() {
        const delimiterPos = this.receivedBuffer.lastIndexOf(';');
        if (delimiterPos === -1) return;
        
        const dataToSend = this.receivedBuffer.substring(0, delimiterPos + 1);
        this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1);
        
        if (!dataToSend) return;

        if (dataToSend.includes('.error,')) {
            const errorMatch = dataToSend.match(/\d+\.error,(\d+)\.([^,]+),/);
            if (errorMatch) {
                const errorMessage = errorMatch[2];
                logger.error(`Guacd error received`, { sessionId: this.sessionId, error: errorMessage, isMaster: this.isMaster });
                this.handleClose(`error: ${errorMessage}`);
                return;
            }
        }

        if (this.isMaster && !this.guacdConnectionId && dataToSend.includes('5.ready')) {
            const match = dataToSend.match(/5\.ready,(\d+)\.([^;]+);/);
            if (match?.[2]) {
                this.guacdConnectionId = match[2];
                logger.info(`Guacd connection ready`, { sessionId: this.sessionId, connectionId: this.guacdConnectionId });
                SessionManager.updateMasterConnectionId(this.sessionId, this.guacdConnectionId);
                this.onReadyCallback?.(this.guacdConnectionId);
            }
        }

        if (this.onDataCallback) {
            this.onDataCallback(dataToSend);
        }
    }

    send(data) {
        if (this.state === 'closed' || !this.guacdConnection) return;
        try {
            this.guacdConnection.write(data);
        } catch (e) {
            this.handleError(e);
        }
    }

    sendOpCode(parts) {
        const formatted = parts.map(p => {
            const str = p === null ? '' : String(p);
            return str.length + '.' + str;
        }).join(',') + ';';
        this.send(formatted);
    }

    handleClose(reason) {
        if (this.state === 'closed') return;
        this.state = 'closed';
        
        logger.info(`Guacd connection closed`, { sessionId: this.sessionId, reason, isMaster: this.isMaster });
        
        this.cleanup();
        this.onCloseCallback?.(reason);

        if (this.isMaster) {
            SessionManager.onMasterConnectionClosed(this.sessionId, reason);
        }
    }

    handleError(error) {
        if (this.state === 'closed') return;
        
        logger.error(`Guacd connection error`, { sessionId: this.sessionId, error: error?.message });
        
        this.handleClose('error: ' + (error?.message || 'unknown'));
    }

    cleanup() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        
        if (this.guacdConnection) {
            this.guacdConnection.removeAllListeners();
            try { this.guacdConnection.end(); } catch (e) {}
            try { this.guacdConnection.destroy(); } catch (e) {}
            this.guacdConnection = null;
        }
    }

    close() {
        this.handleClose('manual close');
    }

    getConnectionInfo() {
        return {
            guacdConnection: this.guacdConnection,
            guacdConnectionId: this.guacdConnectionId,
            connectionType: this.connectionType,
            keepAliveInterval: this.keepAliveInterval,
            guacdClient: this,
            recordingEnabled: this.recordingEnabled,
            auditLogId: this.auditLogId,
        };
    }
}

module.exports = GuacdClient;
