const net = require("node:net");
const { EventEmitter } = require("node:events");
const flatbuffers = require("flatbuffers");
const {
    MessageType,
    Envelope,
} = require("../generated/control_plane_generated");
const {
    buildEngineHelloAck,
    buildPong,
    buildPing,
    buildSessionOpen,
    buildSessionClose,
    buildSessionJoin,
    buildSessionResize,
    buildExecCommand,
    buildPortCheck,
} = require("./messageBuilders");
const logger = require("../../utils/logger");
const { findByToken, updateLastConnected } = require("../../controllers/engine");
const { sendFrame, createFrameParser } = require("./frameProtocol");

const SESSION_TIMEOUT = 30000;
const DATA_CONNECTION_TIMEOUT = 30000;

class ControlPlaneServer extends EventEmitter {
    constructor() {
        super();
        this.port = Number.parseInt(process.env.CONTROL_PLANE_PORT, 10) || 7800;
        this.host = "0.0.0.0";
        this.server = null;
        this._engines = new Map();
        this._dataConnections = new Map();
        this._pending = new Map();
        this._sessionEngineMap = new Map();
        this._pingInterval = null;
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => this._handleConnection(socket));
            this.server.on("error", (err) => {
                logger.error("Control plane server error", { error: err.message });
                reject(err);
            });
            this.server.listen(this.port, this.host, () => {
                logger.system(`Control plane server listening on ${this.host}:${this.port}`);
                this._startPingLoop();
                resolve();
            });
        });
    }

    stop() {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }

        for (const [, sockets] of this._dataConnections) {
            for (const socket of sockets) socket.destroy();
        }
        this._dataConnections.clear();

        this._rejectAllPending("Server stopping");

        for (const [, engine] of this._engines) {
            engine.socket.destroy();
        }
        this._engines.clear();

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        logger.system("Control plane server stopped");
    }

    openSession(sessionId, sessionType, host, port, params = {}, jumpHosts = [], engineId = null) {
        const engine = this._resolveEngine(engineId);
        if (!engine) return Promise.reject(new Error("No engine connected"));

        const resolvedEngineId = engineId ? String(engineId) : this._getDefaultEngineId();
        if (resolvedEngineId) this._sessionEngineMap.set(sessionId, resolvedEngineId);

        return this._createPendingRequest(sessionId, (result) => {
            if (!result.success) this._sessionEngineMap.delete(sessionId);
        }, () => {
            this._sendFrame(engine.socket, buildSessionOpen(sessionId, sessionType, host, port, params, jumpHosts));
        });
    }

    closeSession(sessionId, engineId = null) {
        const engine = this._resolveEngineForSession(sessionId, engineId);
        if (!engine) return;
        this._sendFrame(engine.socket, buildSessionClose(sessionId));
        this._sessionEngineMap.delete(sessionId);
    }

    joinSession(sessionId, engineId = null) {
        const engine = this._resolveEngineForSession(sessionId, engineId);
        if (!engine) return Promise.reject(new Error("No engine connected"));

        const key = `join:${sessionId}:${Date.now()}`;
        return this._createPendingRequest(key, null, () => {
            this._sendFrame(engine.socket, buildSessionJoin(sessionId));
        }, sessionId);
    }

    sendSessionResize(sessionId, cols, rows, engineId = null) {
        const engine = this._resolveEngineForSession(sessionId, engineId);
        if (!engine) return;
        this._sendFrame(engine.socket, buildSessionResize(sessionId, cols, rows));
    }

    execCommand(host, port, params, command, jumpHosts = [], engineId = null) {
        const engine = this._resolveEngine(engineId);
        if (!engine) return Promise.reject(new Error("No engine connected"));

        const requestId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        return this._createPendingRequest(requestId, null, () => {
            this._sendFrame(engine.socket, buildExecCommand(requestId, host, port, params, command, jumpHosts));
        });
    }

    portCheck(targets, timeoutMs = 2000, engineId = null) {
        const engine = this._resolveEngine(engineId);
        if (!engine) return Promise.reject(new Error("No engine connected"));

        const requestId = `portcheck-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        return this._createPendingRequest(requestId, null, () => {
            this._sendFrame(engine.socket, buildPortCheck(requestId, targets, timeoutMs));
        });
    }

    hasEngine() {
        return this._engines.size > 0;
    }

    waitForDataConnection(sessionId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.removeListener("dataConnectionReady", handler);
                reject(new Error("Data connection timeout"));
            }, DATA_CONNECTION_TIMEOUT);

            const handler = ({ sessionId: sid, socket }) => {
                if (sid !== sessionId) return;
                clearTimeout(timeout);
                this.removeListener("dataConnectionReady", handler);
                resolve(socket);
            };
            this.on("dataConnectionReady", handler);
        });
    }

    getEngineInfo(engineId) {
        return this._engines.get(String(engineId)) || null;
    }

    disconnectEngine(engineId) {
        const key = String(engineId);
        const engine = this._engines.get(key);
        if (!engine) return false;
        engine.socket.destroy();
        this._engines.delete(key);
        return true;
    }

    _createPendingRequest(key, onResult, onSend, joinSessionId = null) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pending.delete(key);
                reject(new Error("Request timeout"));
            }, SESSION_TIMEOUT);

            this._pending.set(key, { resolve, reject, timeout, onResult, joinSessionId });
            onSend();
        });
    }

    _resolvePending(key, result) {
        const entry = this._pending.get(key);
        if (!entry) return false;
        clearTimeout(entry.timeout);
        this._pending.delete(key);
        entry.onResult?.(result);
        entry.resolve(result);
        return true;
    }

    _rejectPending(key, error) {
        const entry = this._pending.get(key);
        if (!entry) return false;
        clearTimeout(entry.timeout);
        this._pending.delete(key);
        entry.reject(error);
        return true;
    }

    _rejectAllPending(message) {
        const err = new Error(message);
        for (const [, entry] of this._pending) {
            clearTimeout(entry.timeout);
            entry.reject(err);
        }
        this._pending.clear();
    }

    _findPendingByJoinSession(sessionId) {
        for (const [key, entry] of this._pending) {
            if (entry.joinSessionId === sessionId) return key;
        }
        return null;
    }

    _resolveEngine(engineId) {
        return engineId
            ? this._engines.get(String(engineId))
            : this._getDefaultEngine();
    }

    _resolveEngineForSession(sessionId, engineId) {
        const resolvedId = engineId ? String(engineId) : this._sessionEngineMap.get(sessionId);
        return resolvedId ? this._engines.get(resolvedId) : this._getDefaultEngine();
    }

    _handleConnection(socket) {
        const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
        let identified = false;

        const frameParser = createFrameParser(
            (payload) => {
                const bb = new flatbuffers.ByteBuffer(new Uint8Array(payload));
                const envelope = Envelope.getRootAsEnvelope(bb);
                const msgType = envelope.msgType();

                if (identified) {
                    this._handleControlMessage(socket, envelope, msgType);
                    return;
                }

                identified = true;
                if (msgType === MessageType.EngineHello) {
                    this._handleEngineHello(socket, envelope, remoteAddr);
                } else if (msgType === MessageType.ConnectionReady) {
                    socket.removeListener("data", onData);
                    this._handleConnectionReady(socket, envelope, remoteAddr, frameParser.drain());
                } else {
                    logger.warn(`Control plane: unexpected first message type ${msgType} from ${remoteAddr}`);
                    socket.destroy();
                }
            },
            (len) => {
                logger.error(`Control plane: invalid frame length ${len} from ${remoteAddr}`);
                socket.destroy();
            }
        );

        const onData = (data) => frameParser(data);

        socket.on("data", onData);
        socket.on("error", (err) => {
            logger.debug(`Control plane: socket error from ${remoteAddr}: ${err.message}`);
        });
        socket.on("close", () => this._handleDisconnect(socket));
    }

    async _handleEngineHello(socket, envelope, remoteAddr) {
        const hello = envelope.engineHello();
        if (!hello) {
            socket.destroy();
            return;
        }

        const version = hello.version();
        const registrationToken = hello.registrationToken();

        if (!registrationToken) {
            this._sendFrame(socket, buildEngineHelloAck(false));
            socket.destroy();
            return;
        }

        const engineRecord = await findByToken(registrationToken);
        if (!engineRecord) {
            logger.warn(`Control plane: invalid registration token from ${remoteAddr}`);
            this._sendFrame(socket, buildEngineHelloAck(false));
            socket.destroy();
            return;
        }

        const dbEngineId = String(engineRecord.id);
        logger.system(`Engine connected: id=${dbEngineId} name=${engineRecord.name} version=${version} from ${remoteAddr}`);

        this._engines.set(dbEngineId, {
            socket,
            engineId: dbEngineId,
            version,
            remoteAddr,
            connectedAt: Date.now(),
            lastPong: Date.now(),
        });

        await updateLastConnected(engineRecord.id);
        this._sendFrame(socket, buildEngineHelloAck(true));
        this.emit("engineConnected", { engineId: dbEngineId, version, remoteAddr });
    }

    _handleConnectionReady(socket, envelope, remoteAddr, residualBuf) {
        const ready = envelope.connectionReady();
        if (!ready) {
            socket.destroy();
            return;
        }

        const sessionId = ready.sessionId();
        logger.info(`Data connection ready for session ${sessionId} from ${remoteAddr}`);

        if (!this._dataConnections.has(sessionId)) {
            this._dataConnections.set(sessionId, new Set());
        }
        const sockets = this._dataConnections.get(sessionId);
        sockets.add(socket);

        socket.on("close", () => {
            sockets.delete(socket);
            if (sockets.size === 0) this._dataConnections.delete(sessionId);
            this.emit("dataConnectionClosed", { sessionId });
        });

        const pendingKey = this._findPendingByJoinSession(sessionId);
        if (pendingKey) {
            this._resolvePending(pendingKey, socket);
        } else {
            this.emit("dataConnectionReady", { sessionId, socket });
        }

        if (residualBuf && residualBuf.length > 0) {
            socket.unshift(residualBuf);
        }
    }

    _handleControlMessage(socket, envelope, msgType) {
        switch (msgType) {
            case MessageType.Pong: {
                const engineId = this._findEngineId(socket);
                if (engineId) this._engines.get(engineId).lastPong = Date.now();
                break;
            }

            case MessageType.Ping: {
                const ping = envelope.ping();
                const ts = ping ? ping.timestamp() : BigInt(0);
                this._sendFrame(socket, buildPong(ts));
                break;
            }

            case MessageType.SessionOpenResult: {
                const result = envelope.sessionOpenResult();
                if (!result) break;

                const sessionId = result.sessionId();
                const payload = {
                    success: result.success(),
                    errorMessage: result.errorMessage(),
                    connectionId: result.connectionId(),
                    sessionId,
                };

                if (payload.success) {
                    this._resolvePending(sessionId, payload);
                } else {
                    this._rejectPending(sessionId, new Error(payload.errorMessage || "Session open failed"));
                }

                this.emit("sessionOpenResult", payload);
                break;
            }

            case MessageType.SessionClosed: {
                const closed = envelope.sessionClosed();
                if (!closed) break;
                logger.info(`SessionClosed: session=${closed.sessionId()} reason=${closed.reason()}`);
                this.emit("sessionClosed", { sessionId: closed.sessionId(), reason: closed.reason() });
                break;
            }

            case MessageType.ExecCommandResult: {
                const result = envelope.execCommandResult();
                if (!result) break;

                this._resolvePending(result.requestId(), {
                    success: result.success(),
                    stdout: result.stdoutData() || "",
                    stderr: result.stderrData() || "",
                    exitCode: result.exitCode(),
                    errorMessage: result.errorMessage(),
                });
                break;
            }

            case MessageType.PortCheckResult: {
                const result = envelope.portCheckResult();
                if (!result) break;

                const requestId = result.requestId();
                const resultsLen = result.resultsLength();
                const entries = [];
                for (let i = 0; i < resultsLen; i++) {
                    const entry = result.results(i);
                    entries.push({ id: entry.id(), online: entry.online() });
                }

                this._resolvePending(requestId, { entries });
                break;
            }

            default:
                logger.warn(`Control plane: unhandled message type ${msgType}`);
        }
    }

    _handleDisconnect(socket) {
        for (const [engineId, engine] of this._engines) {
            if (engine.socket !== socket) continue;

            logger.system(`Engine disconnected: id=${engineId}`);
            this._engines.delete(engineId);

            for (const [sid, eid] of this._sessionEngineMap) {
                if (eid === engineId) this._sessionEngineMap.delete(sid);
            }

            this.emit("engineDisconnected", { engineId });
            break;
        }
    }

    _sendFrame(socket, payload) {
        sendFrame(socket, payload);
    }

    _findEngineId(socket) {
        for (const [engineId, engine] of this._engines) {
            if (engine.socket === socket) return engineId;
        }
        return null;
    }

    _getDefaultEngine() {
        const first = this._engines.entries().next();
        return first.done ? null : first.value[1];
    }

    _getDefaultEngineId() {
        const first = this._engines.keys().next();
        return first.done ? null : first.value;
    }

    _startPingLoop() {
        this._pingInterval = setInterval(() => {
            const pingBuf = buildPing();
            for (const [, engine] of this._engines) {
                this._sendFrame(engine.socket, pingBuf);
            }
        }, 15000);
    }
}

module.exports = new ControlPlaneServer();
