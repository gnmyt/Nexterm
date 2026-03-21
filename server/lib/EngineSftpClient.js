const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const flatbuffers = require("flatbuffers");
const {
    SftpMsgType,
    PathReq, RmdirReq, RenameReq, ChmodReq,
    WriteBeginReq, WriteDataReq, ExecReq, SearchReq,
    SftpMessage,
} = require("./generated/sftp_protocol_generated");
const { sendFrame, createFrameParser } = require("./controlPlane/frameProtocol");

const WRITE_CHUNK_SIZE = 32768;

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
};

class EngineSftpClient extends EventEmitter {
    constructor(socket) {
        super();
        this._socket = socket;
        this._requestId = 0;
        this._pending = new Map();
        this._closed = false;

        this._readyPromise = new Promise((resolve, reject) => {
            this._readyResolve = resolve;
            this._readyReject = reject;
        });

        const frameParser = createFrameParser((payload) => this._handleMessage(payload));
        this._socket.on("data", (chunk) => frameParser(chunk));
        this._socket.on("error", (err) => this._abort(err));
        this._socket.on("close", () => this._abort(new Error("Connection closed"), true));
    }

    waitForReady() {
        return this._readyPromise;
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
        const rid = this._nextId();
        const stream = new PassThrough();

        let sizeResolved = false;
        let resolveTotalSize;
        const totalSizePromise = new Promise((r) => { resolveTotalSize = r; });

        let resolveDone, rejectDone;
        const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });

        const emitSize = (size) => {
            if (sizeResolved) return;
            sizeResolved = true;
            resolveTotalSize(size);
        };

        this._pending.set(rid, {
            onFileData: (data, total) => {
                emitSize(Number(total));
                stream.write(Buffer.from(data));
            },
            onFileEnd: () => {
                emitSize(0);
                stream.end();
                this._pending.delete(rid);
                resolveDone();
            },
            onError: (msg) => {
                emitSize(0);
                stream.destroy(new Error(msg));
                this._pending.delete(rid);
                rejectDone(new Error(msg));
            },
        });

        this._sendPathReq(rid, SftpMsgType.ReadFile, path);
        return { stream, totalSizePromise, done };
    }

    async writeFile(path, source) {
        const rid = this._nextId();

        this._buildAndSend(rid, SftpMsgType.WriteBegin, (b) => {
            const pathOff = b.createString(path);
            WriteBeginReq.startWriteBeginReq(b);
            WriteBeginReq.addPath(b, pathOff);
            return { writeBeginReq: WriteBeginReq.endWriteBeginReq(b) };
        });

        await this._waitResponse(rid);

        if (Buffer.isBuffer(source)) {
            for (let off = 0; off < source.length; off += WRITE_CHUNK_SIZE) {
                this._sendWriteData(rid, source.subarray(off, Math.min(off + WRITE_CHUNK_SIZE, source.length)));
            }
        } else {
            await new Promise((resolve, reject) => {
                source.on("data", (chunk) => {
                    this._sendWriteData(rid, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                source.on("end", resolve);
                source.on("error", reject);
            });
        }

        this._buildAndSend(rid, SftpMsgType.WriteEnd, () => ({}));
        return this._waitResponse(rid);
    }

    exec(command) {
        return this._requestWithPayload(SftpMsgType.Exec, (b) => {
            const cmdOff = b.createString(command);
            ExecReq.startExecReq(b);
            ExecReq.addCommand(b, cmdOff);
            return { execReq: ExecReq.endExecReq(b) };
        });
    }

    searchDirs(searchPath, maxResults = 20) {
        return this._requestWithPayload(SftpMsgType.SearchDirs, (b) => {
            const spOff = b.createString(searchPath);
            SearchReq.startSearchReq(b);
            SearchReq.addSearchPath(b, spOff);
            SearchReq.addMaxResults(b, maxResults);
            return { searchReq: SearchReq.endSearchReq(b) };
        });
    }

    _nextId() {
        return ++this._requestId;
    }

    _pathRequest(msgType, path) {
        const rid = this._nextId();
        this._sendPathReq(rid, msgType, path);
        return this._waitResponse(rid);
    }

    _requestWithPayload(msgType, buildPayload) {
        const rid = this._nextId();
        this._buildAndSend(rid, msgType, buildPayload);
        return this._waitResponse(rid);
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
        const b = new flatbuffers.Builder(chunk.length + 128);
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

    _waitResponse(rid) {
        return new Promise((resolve, reject) => {
            this._pending.set(rid, { resolve, reject });
        });
    }

    _resolvePending(rid, pending, value) {
        this._pending.delete(rid);
        pending.resolve?.(value);
    }

    _rejectAllPending(error) {
        for (const [, p] of this._pending) {
            p.reject?.(error);
            p.onError?.(error.message);
        }
        this._pending.clear();
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
