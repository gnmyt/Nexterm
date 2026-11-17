const SessionManager = require("../SessionManager");

const MAX_LINES = 40;
const MAX_LINE_CHARS = 400;

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const ACCENT = "\x1b[38;5;141m";
const CLEAR_LINE = "\r\x1b[2K";

const ALT_SCREEN_ON = /\x1b\[\?(?:1049|1047|47)h/g;
const ALT_SCREEN_OFF = /\x1b\[\?(?:1049|1047|47)l/g;

const lastIndexOf = (text, pattern) => {
    let index = -1;
    for (const match of text.matchAll(pattern)) index = match.index;
    return index;
};

const isAltScreen = (buffer) => lastIndexOf(buffer, ALT_SCREEN_ON) > lastIndexOf(buffer, ALT_SCREEN_OFF);

const currentLine = (buffer) => buffer.slice(buffer.lastIndexOf("\n") + 1);

const sanitize = (text) => String(text ?? "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b./g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");

const clip = (line) => (line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line);

const formatBlock = (text, color = "") => {
    const lines = sanitize(text).replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
    if (lines.length === 1 && lines[0] === "") return [];
    const shown = lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines;
    const out = [];
    if (shown.length < lines.length) out.push(`${DIM}  … ${lines.length - shown.length} earlier lines${RESET}`);
    for (const line of shown) out.push(`${color}  ${clip(line)}${RESET}`);
    return out;
};

const getTarget = (sessionId) => {
    const session = SessionManager.get(sessionId);
    if (!session || session.configuration?.type === "sftp") return null;
    const conn = SessionManager.getConnection(sessionId);
    if (!conn?.dataSocket || conn.scriptLayer) return null;
    return session;
};

const emit = (sessionId, lines) => {
    const session = getTarget(sessionId);
    if (!session || !lines.length) return;
    const buffer = session.logBuffer || "";
    if (isAltScreen(buffer)) return;
    const pending = currentLine(buffer);
    SessionManager.injectTerminalOutput(sessionId, `${CLEAR_LINE}${lines.join("\r\n")}\r\n${pending}`);
};

const header = (text) => `${ACCENT}▍agent${RESET} ${text}`;

const formatDuration = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const mirrorCommand = (sessionId, command) => {
    const started = Date.now();
    const [first, ...rest] = sanitize(command).split("\n");
    const lines = [header(`${BOLD}$ ${clip(first)}${RESET}`)];
    if (rest.length) lines.push(`${DIM}  … ${rest.length} more line${rest.length === 1 ? "" : "s"}${RESET}`);
    emit(sessionId, lines);

    return {
        done({ stdout, stderr, exitCode }) {
            const status = exitCode === 0
                ? `${GREEN}✓ exit 0${RESET}`
                : `${RED}✗ exit ${exitCode ?? "?"}${RESET}`;
            emit(sessionId, [
                ...formatBlock(stdout),
                ...formatBlock(stderr, RED),
                `${DIM}  └${RESET} ${status} ${DIM}· ${formatDuration(Date.now() - started)}${RESET}`,
            ]);
        },
        failed(err) {
            emit(sessionId, [`${DIM}  └${RESET} ${RED}✗ ${clip(sanitize(err?.message || "failed"))}${RESET}`]);
        },
    };
};

const mirrorNote = (sessionId, text) => emit(sessionId, [header(`${DIM}${clip(sanitize(text))}${RESET}`)]);

module.exports = { mirrorCommand, mirrorNote };
