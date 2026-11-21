const { Terminal } = require("@xterm/headless");

const CURSOR_POSITION_QUERY = "\x1b[6n";
const CURSOR_POSITION_REPORT = /\x1b\[\d+;\d+R/g;
const PARTIAL_QUERY_FLUSH_MS = 25;

// Length of the longest end of `text` that could be the start of a query split across chunks
const partialQueryLength = (text) => {
    for (let length = Math.min(CURSOR_POSITION_QUERY.length - 1, text.length); length > 0; length--) {
        if (CURSOR_POSITION_QUERY.startsWith(text.slice(-length))) return length;
    }
    return 0;
};

/**
 * Returns a function that removes cursor position queries from output before it is passed to `send`.
 * A query split across two chunks is held back until the next chunk, or sent as is after a short delay.
 */
const createQueryFilter = (send) => {
    let pending = "";
    let flushTimer = null;

    return (chunk) => {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        let text = (pending + chunk).replaceAll(CURSOR_POSITION_QUERY, "");
        const held = partialQueryLength(text);
        pending = held ? text.slice(-held) : "";
        if (held) {
            text = text.slice(0, -held);
            flushTimer = setTimeout(() => {
                flushTimer = null;
                const rest = pending;
                pending = "";
                if (rest) send(rest);
            }, PARTIAL_QUERY_FLUSH_MS);
        }
        if (text) send(text);
    };
};

/**
 * Answers cursor position queries (ESC[6n) on the server.
 *
 * Programs like PowerShell's PSReadLine ask for the cursor position after
 * every key press and only wait a short time for the answer. When the browser
 * answers, the reply has to travel back over the WebSocket and often arrives
 * too late, so PSReadLine prints it as text ("56;13R").
 *
 * A headless terminal mirrors the session output, so the reply carries the real
 * cursor position and is sent straight back to the SSH session. The query is
 * removed from the output forwarded to browsers (createQueryFilter) so it is
 * answered only once.
 */
class CursorReporter {
    constructor(write, { cols = 80, rows = 24 } = {}) {
        this.terminal = new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true });
        this.terminal.onData((data) => {
            const reports = data.match(CURSOR_POSITION_REPORT);
            if (reports) write(reports.join(""));
        });
    }

    feed(data) {
        this.terminal.write(typeof data === "string" ? data : new Uint8Array(data));
    }

    resize(cols, rows) {
        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) return;
        if (cols === this.terminal.cols && rows === this.terminal.rows) return;
        this.terminal.resize(cols, rows);
    }

    dispose() {
        this.terminal.dispose();
    }
}

module.exports = { CursorReporter, createQueryFilter };
