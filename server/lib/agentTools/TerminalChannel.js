const { StringDecoder } = require("node:string_decoder");
const crypto = require("node:crypto");

const MAX_BUFFER = 512 * 1024;
const PVE_KEEPALIVE_RESPONSE = "OK";

const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Za-z0-9]|\x1b[=>NOM78HcDE]|\x1b\[\?[0-9;]*[hl]|\x9b[0-?]*[ -/]*[@-~]/g;

const stripAnsi = (text) => text
    .replace(ANSI_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

const ESCAPE_START = /\x1b(?:$|[[\]()=>NOM78HcDE])|\x9b/g;
const MAX_PENDING_ESCAPE = 256;

const incompleteEscapeStart = (text) => {
    let completeEnd = 0;
    for (const match of text.matchAll(ANSI_PATTERN)) completeEnd = match.index + match[0].length;
    ESCAPE_START.lastIndex = Math.max(completeEnd, text.length - MAX_PENDING_ESCAPE);
    const start = ESCAPE_START.exec(text);
    return start ? start.index : -1;
};

const createIncrementalStripper = () => {
    let pending = "";
    let text = "";
    return {
        push(chunk) {
            const combined = pending + chunk;
            let cut = incompleteEscapeStart(combined);
            if (cut === -1) cut = combined.length;
            if (cut > 0 && combined[cut - 1] === "\r") cut--;
            pending = combined.slice(cut);
            text += stripAnsi(combined.slice(0, cut));
            return text;
        },
        get text() { return text; },
    };
};

class TerminalChannel {
    constructor(conn, protocol) {
        this.conn = conn;
        this.protocol = protocol;
        this.socket = conn.dataSocket;
        this.buffer = "";
        this.cursor = 0;
        this.dropped = 0;
        this.closed = false;
        this.decoder = new StringDecoder("utf8");
        this.listeners = new Set();
        this.runLock = Promise.resolve();

        this.onData = (chunk) => {
            const text = this.decoder.write(chunk);
            if (!text) return;
            if (this.protocol === "pve-lxc" && text === PVE_KEEPALIVE_RESPONSE) return;
            this.append(text);
        };
        this.onClose = () => this.close();
        this.socket.on("data", this.onData);
        this.socket.on("close", this.onClose);
    }

    append(text) {
        this.buffer += text;
        if (this.buffer.length > MAX_BUFFER) {
            const overflow = this.buffer.length - MAX_BUFFER;
            this.buffer = this.buffer.slice(overflow);
            this.dropped += overflow;
            this.cursor = Math.max(0, this.cursor - overflow);
        }
        for (const listener of this.listeners) listener(text);
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        try { this.socket.removeListener("data", this.onData); } catch {}
        try { this.socket.removeListener("close", this.onClose); } catch {}
        this.listeners.clear();
    }

    assertOpen() {
        if (this.closed || this.socket.destroyed) throw new Error("Terminal session is not connected");
    }

    write(data) {
        this.assertOpen();
        if (this.protocol === "pve-lxc") {
            this.socket.write(`0:${Buffer.byteLength(data, "utf8")}:${data}`);
        } else {
            this.socket.write(data);
        }
    }

    resize(cols, rows) {
        this.assertOpen();
        if (this.protocol === "pve-lxc") {
            this.socket.write(`1:${cols}:${rows}:`);
        } else if (this.conn.sessionId) {
            require("../controlPlane/ControlPlaneServer").sendSessionResize(this.conn.sessionId, cols, rows);
        }
    }

    read({ raw = false, consume = true } = {}) {
        const text = this.buffer.slice(this.cursor);
        if (consume) this.cursor = this.buffer.length;
        return raw ? text : stripAnsi(text);
    }

    tail(maxChars = 4000, { raw = false } = {}) {
        const text = raw ? this.buffer : stripAnsi(this.buffer);
        return text.length > maxChars ? text.slice(-maxChars) : text;
    }

    mark() {
        return this.buffer.length;
    }

    since(mark, { raw = false } = {}) {
        const text = this.buffer.slice(Math.max(0, mark));
        return raw ? text : stripAnsi(text);
    }

    waitForOutput(mark, { pattern = null, idleMs = 800, timeoutMs = 15000 } = {}) {
        return new Promise((resolve) => {
            let settled = false;
            let idleTimer = null;
            let timeoutTimer = null;

            const finish = (reason) => {
                if (settled) return;
                settled = true;
                this.listeners.delete(listener);
                clearTimeout(idleTimer);
                clearTimeout(timeoutTimer);
                resolve({ reason, output: this.since(mark, { raw: true }) });
            };

            const stripped = createIncrementalStripper();
            stripped.push(this.buffer.slice(Math.max(0, mark)));
            const matches = () => pattern && pattern.test(stripped.text);

            const scheduleIdle = (delay) => {
                if (pattern) return;
                clearTimeout(idleTimer);
                idleTimer = setTimeout(() => finish("idle"), delay);
            };

            const listener = (text) => {
                if (pattern) stripped.push(text);
                if (matches()) return finish("matched");
                scheduleIdle(idleMs);
            };

            this.listeners.add(listener);
            timeoutTimer = setTimeout(() => finish("timeout"), timeoutMs);

            if (matches()) return finish("matched");
            scheduleIdle(stripped.text.length > 0 ? idleMs : Math.max(idleMs * 2, 1500));
        });
    }

    async run(command, { sentinel = false, pattern = null, idleMs = 800, timeoutMs = 15000 } = {}) {
        this.assertOpen();
        const release = await this.acquire();
        try {
            const marker = `__nx${crypto.randomBytes(3).toString("hex")}`;
            const markerPattern = sentinel ? new RegExp(`${marker}:(-?\\d+)(?=\\n)`) : null;
            const line = sentinel
                ? ` ${command}; printf '\\n${marker}:%s\\r\\033[2K' "$?"\r`
                : `${command}\r`;

            this.read({ consume: true });
            const mark = this.mark();
            this.write(line);

            const result = await this.waitForOutput(mark, {
                pattern: markerPattern || pattern,
                idleMs,
                timeoutMs,
            });

            let output = stripAnsi(result.output);
            let exitCode = null;

            if (sentinel) {
                const match = markerPattern.exec(output);
                if (match) {
                    exitCode = Number.parseInt(match[1], 10);
                    output = output.slice(0, match.index);
                }
                output = output.replace(new RegExp(`.*${marker}.*\\n?`, "g"), "");
            }

            output = stripEchoedCommand(output, command);
            this.cursor = this.buffer.length;

            return {
                output: output.trim(),
                exitCode,
                completed: result.reason === "matched",
                timedOut: result.reason === "timeout",
            };
        } finally {
            release();
        }
    }

    acquire() {
        let release;
        const next = new Promise((resolve) => { release = resolve; });
        const previous = this.runLock;
        this.runLock = previous.then(() => next);
        return previous.then(() => release);
    }
}

const stripEchoedCommand = (output, command) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return output;
    const lines = output.split("\n");
    const firstIndex = lines.findIndex((line) => line.trim().length > 0);
    if (firstIndex === -1) return output;
    const firstLine = lines[firstIndex].trim();
    const isEcho = firstLine.includes(trimmedCommand) || trimmedCommand.startsWith(firstLine);
    if (isEcho) lines.splice(0, firstIndex + 1);
    return lines.join("\n");
};

const getTerminalChannel = (conn, protocol, initialOutput = "") => {
    if (!conn?.dataSocket) throw new Error("Session has no terminal stream");
    if (conn.agentTerminal && !conn.agentTerminal.closed) return conn.agentTerminal;
    conn.agentTerminal = new TerminalChannel(conn, protocol);
    if (initialOutput) conn.agentTerminal.buffer = initialOutput;
    return conn.agentTerminal;
};

module.exports = { TerminalChannel, getTerminalChannel, stripAnsi };
