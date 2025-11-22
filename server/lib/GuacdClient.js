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

class GuacdClient {

    constructor(clientConnection, forcedConnectionId = null) {
        this.STATE_OPENING = 0;
        this.STATE_OPEN = 1;
        this.STATE_CLOSED = 2;

        this.state = this.STATE_OPENING;

        this.clientConnection = clientConnection;
        this.forcedConnectionId = forcedConnectionId;
        this.guacdConnectionId = null;
        this.handshakeReplySent = false;
        this.receivedBuffer = '';
        this.lastActivity = Date.now();

        this.guacdConnection = Net.connect(4822, '127.0.0.1');

        this.guacdConnection.on('connect', this.processConnectionOpen.bind(this));
        this.guacdConnection.on('data', this.processReceivedData.bind(this));
        this.guacdConnection.on('close', this.clientConnection.close.bind(this.clientConnection));
        this.guacdConnection.on('error', this.clientConnection.error.bind(this.clientConnection));

        this.activityCheckInterval = setInterval(this.checkActivity.bind(this), 1000);
    }

    checkActivity() {
        if (Date.now() > (this.lastActivity + 10000)) {
            this.clientConnection.close(new Error('guacd was inactive for too long'));
        }
    }

    close() {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        clearInterval(this.activityCheckInterval);

        this.guacdConnection.removeAllListeners('close');
        this.guacdConnection.end();
        this.guacdConnection.destroy();

        this.state = this.STATE_CLOSED;
    }

    send(data) {
        if (this.state === this.STATE_CLOSED) {
            return;
        }

        this.guacdConnection.write(data);
    }

    processConnectionOpen() {
        if (this.forcedConnectionId) {
            this.sendOpCode(['select', this.forcedConnectionId]);
        } else {
            this.sendOpCode(['select', this.clientConnection.connectionType]);
        }
    }

    sendSize() {
        this.sendOpCode([
            'size',
            this.clientConnection.connectionSettings.connection.width,
            this.clientConnection.connectionSettings.connection.height,
            this.clientConnection.connectionSettings.connection.dpi
        ]);
    }

    sendHandshakeReply() {
        this.sendSize();
        this.sendOpCode(['audio'].concat(this.clientConnection.GUAC_AUDIO || []));
        this.sendOpCode(['video'].concat(this.clientConnection.GUAC_VIDEO || []));
        this.sendOpCode(['image']);

        let serverHandshake = this.getFirstOpCodeFromBuffer();

        serverHandshake = serverHandshake.split(',');
        let connectionOptions = [];

        serverHandshake.forEach((attribute) => {
            connectionOptions.push(this.getConnectionOption(attribute));
        });

        this.sendOpCode(connectionOptions);

        this.handshakeReplySent = true;

        if (this.state !== this.STATE_OPEN) {
            this.state = this.STATE_OPEN;
        }
    }

    getConnectionOption(optionName) {
        return this.clientConnection.connectionSettings.connection[this.constructor.parseOpCodeAttribute(optionName)] || null
    }

    getFirstOpCodeFromBuffer() {
        let delimiterPos = this.receivedBuffer.indexOf(';');
        let opCode = this.receivedBuffer.substring(0, delimiterPos);

        this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1, this.receivedBuffer.length);

        return opCode;
    }

    sendOpCode(opCode) {
        opCode = this.constructor.formatOpCode(opCode);
        this.send(opCode);
    }

    static formatOpCode(opCodeParts) {
        opCodeParts.forEach((part, index, opCodeParts) => {
            part = this.stringifyOpCodePart(part);
            opCodeParts[index] = part.length + '.' + part;
        });

        return opCodeParts.join(',') + ';';
    }

    static stringifyOpCodePart(part) {
        if (part === null) {
            part = '';
        }

        return String(part);
    }

    static parseOpCodeAttribute(opCodeAttribute) {
        return opCodeAttribute.substring(opCodeAttribute.indexOf('.') + 1, opCodeAttribute.length);
    }

    processReceivedData(data) {
        this.receivedBuffer += data;
        this.lastActivity = Date.now();

        if (!this.handshakeReplySent) {
            if (this.receivedBuffer.indexOf(';') === -1) {
                return; // incomplete handshake received from guacd. Will wait for the next part
            } else {
                this.sendHandshakeReply();
            }
        }

        this.sendBufferToWebSocket();
    }

    sendBufferToWebSocket() {
        const delimiterPos = this.receivedBuffer.lastIndexOf(';');
        const bufferPartToSend = this.receivedBuffer.substring(0, delimiterPos + 1);

        if (bufferPartToSend) {
            this.receivedBuffer = this.receivedBuffer.substring(delimiterPos + 1, this.receivedBuffer.length);

            if (!this.guacdConnectionId && bufferPartToSend.includes('5.ready')) {
                const parts = bufferPartToSend.split(',');
                if (parts.length >= 2) {
                    const match = bufferPartToSend.match(/5\.ready,(\d+)\.([^;]+);/);
                    if (match && match[2]) {
                        this.guacdConnectionId = match[2];
                    }
                }
            }

            this.clientConnection.send(bufferPartToSend);
        }
    }

}

module.exports = GuacdClient;