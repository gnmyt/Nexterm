const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const flatbuffers = require("flatbuffers");
const {
    SftpMsgType,
    PathReq, RmdirReq, RenameReq, ChmodReq,
    WriteBeginReq, WriteDataReq, ExecReq, SearchReq, ThumbnailReq,
    SftpMessage,
} = require("./generated/sftp_protocol_generated");
const { sendFrame, createFrameParser } = require("./controlPlane/frameProtocol");
const logger = require("../utils/logger");

const WRITE_CHUNK_SIZE = 262144;
const SOCKET_HIGH_WATER = WRITE_CHUNK_SIZE * 4;
const READ_STREAM_HIGH_WATER = 4 * 1024 * 1024;
const REQUEST_TIMEOUT = 30000;
const WRITE_END_TIMEOUT = 120000;
const TRANSFER_STALL_TIMEOUT = 120000;
const EXEC_TIMEOUT = 300000;
const SEARCH_TIMEOUT_MARGIN = 35000;

const CANCELLED_MESSAGE = "Transfer cancelled";

class TransferCancelledError extends Error {
    constructor() {
        super(CANCELLED_MESSAGE);
        this.name = "TransferCancelledError";
        this.cancelled = true;
    }
}

const isCancelled = (error) => error?.cancelled === true || error?.message === CANCELLED_MESSAGE;

const MESSAGE_HANDLERS = {
    [SftpMsgType.Ok]: (_msg, rid, pending, self) => {
        self._resolvePending(rid, pending);
    },

    [SftpMsgType.Error]: (msg, rid, pending, self) => {
        const message = msg.errorRes()?.message() || "Unknown error";
        self._pending.delete(rid);
        pending.reject?.(new Error(message));
        pending.onError?.(message);
    },

    [SftpMsgType.DirList]: (msg, rid, pending, self) => {
        const res = msg.dirListRes();
        const entries = [];
        if (res) {
            for (let i = 0; i < res.entriesLength(); i++) {
                const e = res.entries(i);
                entries.push({
                    name: e.name(),
                    type: e.isDir() ? "folder" : "file",
                    isSymlink: e.isSymlink(),
                    last_modified: e.mtime(),
                    size: Number(e.size()),
                    mode: e.mode(),
                });
            }
        }
        self._resolvePending(rid, pending, entries);
    },

    [SftpMsgType.StatResult]: (msg, rid, pending, self) => {
        const res = msg.statRes();
        self._resolvePending(rid, pending, res ? {
            size: Number(res.size()),
            mode: res.mode(),
            uid: res.uid(),
            gid: res.gid(),
            atime: res.atime(),
            mtime: res.mtime(),
            owner: res.owner() || "",
            group: res.group() || "",
            isDir: res.isDir(),
        } : {});
    },

    [SftpMsgType.RealpathResult]: (msg, rid, pending, self) => {
        const res = msg.realpathRes();
        self._resolvePending(rid, pending, res ? { path: res.path(), isDirectory: res.isDir() } : {});
    },

    [SftpMsgType.FileData]: (msg, _rid, pending) => {
        if (!pending.onFileData) return;
        const res = msg.fileDataRes();
        if (res) pending.onFileData(res.dataArray(), res.totalSize());
    },

    [SftpMsgType.FileEnd]: (_msg, _rid, pending) => {
        pending.onFileEnd?.();
    },

    [SftpMsgType.ExecResult]: (msg, rid, pending, self) => {
        const res = msg.execRes();
        self._resolvePending(rid, pending, res
            ? { stdout: res.stdoutData() || "", stderr: res.stderrData() || "", exitCode: res.exitCode() }
            : { stdout: "", stderr: "", exitCode: -1 });
    },

    [SftpMsgType.SearchResult]: (msg, rid, pending, self) => {
        const res = msg.searchRes();
        const dirs = [];
        if (res) {
            for (let i = 0; i < res.directoriesLength(); i++) dirs.push(res.directories(i));
        }
        self._resolvePending(rid, pending, dirs);
    },

    [SftpMsgType.ThumbnailResult]: (msg, rid, pending, self) => {
        const res = msg.thumbnailRes();
        const data = res?.dataArray();
        const buf = data ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : Buffer.alloc(0);
        self._resolvePending(rid, pending, { data: buf, width: res?.width() || 0, height: res?.height() || 0 });
    },
};

class EngineSftpClient extends EventEmitter {
    constructor(socket) {
        super();
        this._socket = socket;
        this._requestId = 0;
        this._pending = new Map();
        this._queue = [];
        this._busy = false;
        this._closed = false;

        this._readyPromise = new Promise((resolve, reject) => {
            this._readyResolve = resolve;
            this._readyReject = reject;
        });

        const frameParser = createFrameParser(
            (payload) => this._handleMessage(payload),
            (reason) => {
                logger.warn(`EngineSftpClient: protocol error: ${reason}`);
                this._socket.destroy();
            }
        );
        this._socket.on("data", (chunk) => frameParser(chunk));
        this._socket.on("error", (err) => this._abort(err));
        this._socket.on("close", () => this._abort(new Error("Connection closed"), true));
    }

    waitForReady() {
        return this._readyPromise;
    }

    get queueLength() {
        return this._queue.length + (this._busy ? 1 : 0);
    }

    close() {
        if (this._closed) return;
        this._closed = true;
        this._socket.destroy();
        this._rejectAllPending(new Error("Connection closed"));
    }

    listDir(path) {
        return this._pathRequest(SftpMsgType.ListDir, path);
    }

    stat(path) {
        return this._pathRequest(SftpMsgType.Stat, path);
    }

    mkdir(path) {
        return this._pathRequest(SftpMsgType.Mkdir, path);
    }

    async mkdirRecursive(path) {
        if ((await this.stat(path).catch(() => null))?.isDir) return [];

        const segments = path.split("/").filter(Boolean);
        const created = [];
        let current = path.startsWith("/") ? "" : ".";

        for (const segment of segments) {
            current = `${current}/${segment}`;
            if ((await this.stat(current).catch(() => null))?.isDir) continue;
            try {
                await this.mkdir(current);
                created.push(current);
            } catch (err) {
                if (!(await this.stat(current).catch(() => null))?.isDir) throw err;
            }
        }

        return created;
    }

    unlink(path) {
        return this._pathRequest(SftpMsgType.Unlink, path);
    }

    realpath(path) {
        return this._pathRequest(SftpMsgType.Realpath, path);
    }

    rmdir(path, recursive = false) {
        return this._requestWithPayload(SftpMsgType.Rmdir, (b) => {
            const pathOff = b.createString(path);
            RmdirReq.startRmdirReq(b);
            RmdirReq.addPath(b, pathOff);
            RmdirReq.addRecursive(b, recursive);
            return { rmdirReq: RmdirReq.endRmdirReq(b) };
        });
    }

    rename(oldPath, newPath) {
        return this._requestWithPayload(SftpMsgType.Rename, (b) => {
            const oldOff = b.createString(oldPath);
            const newOff = b.createString(newPath);
            RenameReq.startRenameReq(b);
            RenameReq.addOldPath(b, oldOff);
            RenameReq.addNewPath(b, newOff);
            return { renameReq: RenameReq.endRenameReq(b) };
        });
    }

    chmod(path, mode) {
        return this._requestWithPayload(SftpMsgType.Chmod, (b) => {
            const pathOff = b.createString(path);
            ChmodReq.startChmodReq(b);
            ChmodReq.addPath(b, pathOff);
            ChmodReq.addMode(b, mode);
            return { chmodReq: ChmodReq.endChmodReq(b) };
        });
    }

    readFile(path) {
        const stream = new PassThrough({ highWaterMark: READ_STREAM_HIGH_WATER });
        stream.on("error", () => {});

        let resolveTotalSize;
        const totalSizePromise = new Promise((resolve) => { resolveTotalSize = resolve; });
        let resolveDone, rejectDone;
        const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
        done.catch(() => {});

        const state = {
            rid: null, finished: false, ended: false, queued: true, stallTimer: null,
            sizeKnown: false, total: 0, received: 0,
        };
        const fullyDelivered = () => state.sizeKnown && state.received >= state.total;

        const emitSize = (size) => {
            if (state.sizeKnown) return;
            state.sizeKnown = true;
            resolveTotalSize(size);
        };

        const resumeSocket = () => {
            if (this._socket.isPaused()) this._socket.resume();
        };

        const clearStall = () => {
            clearTimeout(state.stallTimer);
            state.stallTimer = null;
        };

        let finishRead;

        const armStall = () => {
            clearStall();
            state.stallTimer = setTimeout(() => {
                if (state.finished) return;
                logger.warn("EngineSftpClient: file read stalled, cancelling", { path });
                this._sendCancelRead(state.rid);
                finishRead(new Error("Transfer stalled"));
            }, TRANSFER_STALL_TIMEOUT);
        };

        finishRead = (error) => {
            if (state.finished) return;
            state.finished = true;
            clearStall();
            if (state.rid !== null) this._pending.delete(state.rid);
            resumeSocket();
            emitSize(0);
            if (error) {
                if (!stream.destroyed) stream.destroy(error);
                rejectDone(error);
            } else {
                state.ended = true;
                if (!stream.destroyed) stream.end();
                resolveDone();
            }
            state.release?.();
        };

        const cancel = () => {
            if (state.finished) return;
            if (state.queued) {
                this._removeQueued(state.task);
                finishRead(new TransferCancelledError());
                return;
            }
            this._sendCancelRead(state.rid);
            finishRead(new TransferCancelledError());
        };

        stream.on("close", () => {
            if (state.ended || state.finished) return;
            if (fullyDelivered()) {
                resumeSocket();
                return;
            }
            cancel();
        });

        state.task = () => new Promise((release) => {
            state.release = release;
            state.queued = false;
            if (this._closed) {
                finishRead(new Error("Connection closed"));
                return;
            }

            const rid = this._nextId();
            state.rid = rid;

            this._pending.set(rid, {
                onFileData: (data, total) => {
                    if (state.finished) return;
                    state.total = Number(total);
                    emitSize(state.total);
                    state.received += data.byteLength;
                    if (stream.destroyed) return;
                    const chunk = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
                    if (stream.write(chunk)) {
                        armStall();
                        return;
                    }
                    clearStall();
                    this._socket.pause();
                    stream.once("drain", () => {
                        if (state.finished) return;
                        resumeSocket();
                        armStall();
                    });
                },
                onFileEnd: () => finishRead(null),
                onError: (message) => finishRead(isCancelled({ message }) ? new TransferCancelledError() : new Error(message)),
            });

            armStall();
            this._sendPathReq(rid, SftpMsgType.ReadFile, path);
        });

        this._enqueue(state.task).catch((err) => finishRead(err));

        return { stream, totalSizePromise, done, cancel };
    }

    writeFile(path, source, options = {}) {
        return this._enqueue(async () => {
            const rid = this._nextId();

            this._buildAndSend(rid, SftpMsgType.WriteBegin, (b) => {
                const pathOff = b.createString(path);
                WriteBeginReq.startWriteBeginReq(b);
                WriteBeginReq.addPath(b, pathOff);
                return { writeBeginReq: WriteBeginReq.endWriteBeginReq(b) };
            });
            await this._waitResponse(rid);

            let failEarly;
            const engineFailure = new Promise((_, reject) => { failEarly = reject; });
            engineFailure.catch(() => {});
            this._pending.set(rid, { onError: (message) => failEarly(new Error(message)) });

            const abortState = { stopped: false };
            const onAbort = () => failEarly(new TransferCancelledError());
            options.signal?.addEventListener("abort", onAbort, { once: true });

            try {
                if (options.signal?.aborted) throw new TransferCancelledError();
                await Promise.race([this._pumpWriteData(rid, source, abortState, options.onProgress), engineFailure]);
            } catch (err) {
                abortState.stopped = true;
                this._pending.delete(rid);
                if (!Buffer.isBuffer(source) && !source.destroyed) source.destroy();
                await this._abortWrite();
                throw err;
            } finally {
                options.signal?.removeEventListener("abort", onAbort);
            }

            this._pending.delete(rid);
            this._buildAndSend(rid, SftpMsgType.WriteEnd, () => ({}));
            return this._waitResponse(rid, WRITE_END_TIMEOUT);
        });
    }

    exec(command, timeoutMs = EXEC_TIMEOUT, stdinData = null) {
        return this._requestWithPayload(SftpMsgType.Exec, (b) => {
            const cmdOff = b.createString(command);
            const stdinOff = stdinData ? b.createString(stdinData) : null;
            ExecReq.startExecReq(b);
            ExecReq.addCommand(b, cmdOff);
            ExecReq.addTimeoutMs(b, timeoutMs);
            if (stdinOff !== null) ExecReq.addStdinData(b, stdinOff);
            return { execReq: ExecReq.endExecReq(b) };
        }, timeoutMs + 15000);
    }

    thumbnail(path, size = 100) {
        return this._requestWithPayload(SftpMsgType.Thumbnail, (b) => {
            const pathOff = b.createString(path);
            ThumbnailReq.startThumbnailReq(b);
            ThumbnailReq.addPath(b, pathOff);
            ThumbnailReq.addSize(b, size);
            return { thumbnailReq: ThumbnailReq.endThumbnailReq(b) };
        });
    }

    searchDirs(searchPath, maxResults = 20, timeoutMs = REQUEST_TIMEOUT) {
        return this._requestWithPayload(SftpMsgType.SearchDirs, (b) => {
            const spOff = b.createString(searchPath);
            SearchReq.startSearchReq(b);
            SearchReq.addSearchPath(b, spOff);
            SearchReq.addMaxResults(b, maxResults);
            SearchReq.addTimeoutMs(b, timeoutMs);
            return { searchReq: SearchReq.endSearchReq(b) };
        }, timeoutMs + SEARCH_TIMEOUT_MARGIN);
    }

    _enqueue(task) {
        return new Promise((resolve, reject) => {
            if (this._closed) {
                reject(new Error("Connection closed"));
                return;
            }
            this._queue.push({ task, resolve, reject });
            this._drainQueue();
        });
    }

    _removeQueued(task) {
        const index = this._queue.findIndex((entry) => entry.task === task);
        if (index === -1) return;
        const [entry] = this._queue.splice(index, 1);
        entry.reject(new TransferCancelledError());
    }

    _drainQueue() {
        if (this._busy || this._queue.length === 0) return;
        const { task, resolve, reject } = this._queue.shift();
        this._busy = true;
        Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
                this._busy = false;
                this._drainQueue();
            });
    }

    async _pumpWriteData(rid, source, abortState, onProgress) {
        let sent = 0;
        const sendChunk = async (buf) => {
            for (let off = 0; off < buf.length; off += WRITE_CHUNK_SIZE) {
                if (abortState.stopped) return;
                this._sendWriteData(rid, buf.subarray(off, Math.min(off + WRITE_CHUNK_SIZE, buf.length)));
                if (this._socket.writableLength > SOCKET_HIGH_WATER) await this._waitForDrain();
            }
            sent += buf.length;
            onProgress?.(sent);
        };

        if (Buffer.isBuffer(source)) {
            await sendChunk(source);
            return;
        }

        for await (const chunk of source) {
            if (abortState.stopped) return;
            await sendChunk(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
    }

    _waitForDrain() {
        return new Promise((resolve, reject) => {
            if (this._closed) {
                reject(new Error("Connection closed"));
                return;
            }
            const onDrain = () => { cleanup(); resolve(); };
            const onClose = () => { cleanup(); reject(new Error("Connection closed")); };
            const cleanup = () => {
                this._socket.removeListener("drain", onDrain);
                this._socket.removeListener("close", onClose);
                this._socket.removeListener("error", onClose);
            };
            this._socket.once("drain", onDrain);
            this._socket.once("close", onClose);
            this._socket.once("error", onClose);
        });
    }

    async _abortWrite() {
        if (this._closed) return;
        const rid = this._nextId();
        this._buildAndSend(rid, SftpMsgType.WriteAbort, () => ({}));
        try {
            await this._waitResponse(rid);
        } catch (err) {
            logger.warn("EngineSftpClient: write abort was not acknowledged", { error: err.message });
        }
    }

    _sendCancelRead(rid) {
        if (rid === null || this._closed) return;
        this._buildAndSend(rid, SftpMsgType.CancelRead, () => ({}));
    }

    _nextId() {
        return ++this._requestId;
    }

    _pathRequest(msgType, path) {
        return this._enqueue(() => {
            const rid = this._nextId();
            this._sendPathReq(rid, msgType, path);
            return this._waitResponse(rid);
        });
    }

    _requestWithPayload(msgType, buildPayload, timeoutMs) {
        return this._enqueue(() => {
            const rid = this._nextId();
            this._buildAndSend(rid, msgType, buildPayload);
            return this._waitResponse(rid, timeoutMs);
        });
    }

    _buildAndSend(rid, msgType, buildPayload) {
        const b = new flatbuffers.Builder(256);
        const fields = buildPayload(b);

        SftpMessage.startSftpMessage(b);
        SftpMessage.addMsgType(b, msgType);
        SftpMessage.addRequestId(b, rid);

        for (const [key, offset] of Object.entries(fields)) {
            const adder = SftpMessage[`add${key[0].toUpperCase()}${key.slice(1)}`];
            if (adder) adder(b, offset);
        }

        const envOff = SftpMessage.endSftpMessage(b);
        SftpMessage.finishSftpMessageBuffer(b, envOff);
        this._sendFrame(b.asUint8Array());
    }

    _sendFrame(payload) {
        if (this._closed) return;
        sendFrame(this._socket, payload);
    }

    _sendPathReq(rid, msgType, path) {
        this._buildAndSend(rid, msgType, (b) => {
            const pathOff = b.createString(path);
            PathReq.startPathReq(b);
            PathReq.addPath(b, pathOff);
            return { pathReq: PathReq.endPathReq(b) };
        });
    }

    _sendWriteData(rid, chunk) {
        const b = new flatbuffers.Builder(chunk.length + 256);
        const dataOff = WriteDataReq.createDataVector(b, chunk);
        WriteDataReq.startWriteDataReq(b);
        WriteDataReq.addData(b, dataOff);
        const reqOff = WriteDataReq.endWriteDataReq(b);

        SftpMessage.startSftpMessage(b);
        SftpMessage.addMsgType(b, SftpMsgType.WriteData);
        SftpMessage.addRequestId(b, rid);
        SftpMessage.addWriteDataReq(b, reqOff);
        const envOff = SftpMessage.endSftpMessage(b);
        SftpMessage.finishSftpMessageBuffer(b, envOff);
        this._sendFrame(b.asUint8Array());
    }

    _waitResponse(rid, timeoutMs = REQUEST_TIMEOUT) {
        return new Promise((resolve, reject) => {
            if (this._closed) {
                reject(new Error("Connection closed"));
                return;
            }
            const timeout = timeoutMs > 0 ? setTimeout(() => {
                this._pending.delete(rid);
                reject(new Error("Request timeout"));
            }, timeoutMs) : null;
            this._pending.set(rid, {
                resolve: (v) => { if (timeout) clearTimeout(timeout); resolve(v); },
                reject: (e) => { if (timeout) clearTimeout(timeout); reject(e); },
            });
        });
    }

    _resolvePending(rid, pending, value) {
        this._pending.delete(rid);
        pending.resolve?.(value);
    }

    _rejectAllPending(error) {
        const pending = [...this._pending.values()];
        this._pending.clear();
        for (const p of pending) {
            p.reject?.(error);
            p.onError?.(error.message);
        }
        const queued = this._queue.splice(0);
        for (const entry of queued) entry.reject(error);
    }

    _abort(error, emitClose = false) {
        this._closed = true;
        if (this._readyReject) {
            this._readyReject(error);
            this._readyReject = null;
        }
        this._rejectAllPending(error);
        if (emitClose) this.emit("close");
    }

    _handleMessage(payload) {
        const bb = new flatbuffers.ByteBuffer(new Uint8Array(payload));
        const msg = SftpMessage.getRootAsSftpMessage(bb);
        const msgType = msg.msgType();
        const rid = msg.requestId();

        if (msgType === SftpMsgType.Ready) {
            if (this._readyResolve) {
                this._readyResolve();
                this._readyResolve = null;
            }
            return;
        }

        const pending = this._pending.get(rid);
        if (!pending) return;

        const handler = MESSAGE_HANDLERS[msgType];
        if (handler) handler(msg, rid, pending, this);
    }
}

module.exports = EngineSftpClient;
module.exports.TransferCancelledError = TransferCancelledError;
module.exports.isCancelled = isCancelled;
