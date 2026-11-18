const { z } = require("zod");
const { ToolError, truncate } = require("../context");
const { getTerminalChannel } = require("../TerminalChannel");
const { mirrorCommand } = require("../ActivityMirror");
const { getSFTPAgentClient, getSessionPassword } = require("../../ConnectionService");
const { execCommand } = require("../../../controllers/execCommand");
const { validateEntryAccess } = require("../../../controllers/entry");
const { AUDIT_ACTIONS } = require("../../../controllers/audit");
const { Permission } = require("../../../permissions/registry");
const SessionManager = require("../../SessionManager");
const Entry = require("../../../models/Entry");

const SPECIAL_KEYS = {
    enter: "\r",
    tab: "\t",
    escape: "\x1b",
    backspace: "\x7f",
    "ctrl-c": "\x03",
    "ctrl-d": "\x04",
    "ctrl-z": "\x1a",
    "ctrl-l": "\x0c",
    "ctrl-a": "\x01",
    "ctrl-e": "\x05",
    "ctrl-u": "\x15",
    up: "\x1b[A",
    down: "\x1b[B",
    right: "\x1b[C",
    left: "\x1b[D",
    home: "\x1b[H",
    end: "\x1b[F",
    pageup: "\x1b[5~",
    pagedown: "\x1b[6~",
    delete: "\x1b[3~",
    f1: "\x1bOP", f2: "\x1bOQ", f3: "\x1bOR", f4: "\x1bOS",
    f5: "\x1b[15~", f6: "\x1b[17~", f7: "\x1b[18~", f8: "\x1b[19~",
    f9: "\x1b[20~", f10: "\x1b[21~", f11: "\x1b[23~", f12: "\x1b[24~",
};

const usesSudo = (command) => /(^|[\n|&;(`]|\$\()\s*sudo\s/.test(command);

const SUDO_SHIM = [
    "if ! command sudo -S -p '' -v 2>/dev/null; then",
    "    echo 'nexterm: sudo authentication failed (wrong password or no sudo rights)' >&2",
    "    exit 1",
    "fi",
    "exec 0</dev/null",
    "trap 'command sudo -k 2>/dev/null' EXIT",
].join("\n");

const resolveTerminal = async (ctx, sessionId) => {
    const { session, entry, protocol, kind } = await ctx.resolveSession(sessionId);
    if (kind !== "terminal") {
        throw new ToolError(`Session ${sessionId} is not a terminal session (protocol: ${protocol})`, "wrong_session_kind");
    }
    const conn = await ctx.waitForConnection(sessionId);
    const channelProtocol = protocol === "pve-shell" ? "pve-lxc" : protocol;
    const terminal = getTerminalChannel(conn, channelProtocol, SessionManager.getLogBuffer(sessionId));
    return { session, entry, protocol, conn, terminal };
};

const redact = (sensitive, value) => (sensitive ? "[redacted]" : value);

module.exports = (define, ctx) => {
    define("terminal_run", {
        confirm: true,
        title: "Run a command in a terminal session",
        description: "Types a command into the interactive shell of a terminal session (SSH, Telnet, Proxmox console) and returns the output it produced. "
            + "Works with any interactive shell: output is collected until the shell goes quiet, a pattern matches, or the timeout expires. "
            + "For POSIX shells a sentinel is appended to detect completion and capture the exit code (useSentinel). "
            + "Interactive programs (editors, pagers, prompts) will time out; use terminal_send / terminal_read for those.",
        inputSchema: {
            sessionId: z.uuid(),
            command: z.string().describe("The command line to type. A newline is appended automatically."),
            timeoutSeconds: z.number().positive().max(900).optional().describe("Maximum time to wait for the output (default 20)."),
            idleMs: z.number().int().min(100).max(10000).optional().describe("Without a sentinel or pattern the command is considered finished once no output arrived for this long (default 800)."),
            waitFor: z.string().optional().describe("Regular expression; return as soon as the output matches it (for example a prompt such as '\\\\$ $' or 'Password:')."),
            useSentinel: z.boolean().optional().describe("Append an echo sentinel to detect completion and capture the exit code. Default: true for SSH sessions, false for Telnet / Proxmox consoles."),
            sensitive: z.boolean().optional().describe("Set when the input is a password or other secret: it is then redacted from the audit log and the output is not echoed back."),
        },
    }, async ({ sessionId, command, timeoutSeconds = 20, idleMs = 800, waitFor, useSentinel, sensitive = false }) => {
        const { entry, protocol, terminal } = await resolveTerminal(ctx, sessionId);
        const sentinel = (useSentinel ?? (protocol === "ssh")) && !sensitive;
        let pattern = null;
        if (waitFor) {
            try { pattern = new RegExp(waitFor, "m"); } catch (err) { throw new ToolError(`Invalid waitFor pattern: ${err.message}`); }
        }

        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_COMMAND, { command: redact(sensitive, command), sessionId, mode: "interactive", sensitive });

        const result = await terminal.run(command, { sentinel: sentinel && !pattern, pattern, idleMs, timeoutMs: timeoutSeconds * 1000 });
        const output = sensitive ? result.output.split(command).join("[redacted]") : result.output;
        return { ...result, output: truncate(output) };
    });

    define("terminal_send", {
        confirm: true,
        title: "Send raw input to a terminal session",
        description: "Sends keystrokes to the interactive terminal without waiting for a result: text, special keys (enter, tab, ctrl-c, ctrl-d, escape, arrows, F-keys) or both. "
            + "Use it to answer prompts, drive editors or interrupt a running command, then call terminal_read to see the reaction.",
        inputSchema: {
            sessionId: z.uuid(),
            text: z.string().optional().describe("Text to type verbatim (no newline is added)."),
            keys: z.array(z.string()).optional().describe(`Special keys to press after the text, in order. One of: ${Object.keys(SPECIAL_KEYS).join(", ")}.`),
            pressEnter: z.boolean().optional().describe("Press Enter after the text and keys (default false)."),
            sensitive: z.boolean().optional().describe("Set when typing a password or secret so it is redacted from the audit log."),
        },
    }, async ({ sessionId, text = "", keys = [], pressEnter = false, sensitive = false }) => {
        const { entry, terminal } = await resolveTerminal(ctx, sessionId);
        let payload = text;
        for (const key of keys) {
            const sequence = SPECIAL_KEYS[String(key).toLowerCase()];
            if (!sequence) throw new ToolError(`Unknown key: ${key}`);
            payload += sequence;
        }
        if (pressEnter) payload += "\r";
        if (!payload) throw new ToolError("Nothing to send");

        terminal.write(payload);
        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_TERMINAL_INPUT, {
            sessionId, text: redact(sensitive || !text, text || undefined), length: payload.length, keys, pressEnter, sensitive,
        });
        return { sent: payload.length, hint: "Call terminal_read to see the output." };
    });

    define("terminal_read", {
        title: "Read terminal output",
        description: "Returns the terminal output received since the previous terminal_read / terminal_run call (ANSI escape codes stripped), plus the last part of the screen buffer for context. Optionally waits for new output first.",
        inputSchema: {
            sessionId: z.uuid(),
            waitMs: z.number().int().min(0).max(30000).optional().describe("Wait up to this long for output to arrive and settle before returning (default 500)."),
            tailChars: z.number().int().min(0).max(20000).optional().describe("How many trailing characters of the full buffer to include as 'screen' (default 2000)."),
            raw: z.boolean().optional().describe("Return the raw bytes including escape sequences instead of stripped text."),
        },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId, waitMs = 500, tailChars = 2000, raw = false }) => {
        const { terminal } = await resolveTerminal(ctx, sessionId);
        if (waitMs > 0) await terminal.waitForOutput(terminal.cursor, { idleMs: 300, timeoutMs: waitMs });
        const output = terminal.read({ raw, consume: true });
        return { output: truncate(output), screen: tailChars > 0 ? terminal.tail(tailChars, { raw }) : undefined };
    });

    define("terminal_resize", {
        title: "Resize the terminal",
        description: "Changes the pseudo-terminal size (columns x rows) of a terminal session. Larger widths avoid wrapped output.",
        inputSchema: {
            sessionId: z.uuid(),
            cols: z.number().int().min(20).max(500),
            rows: z.number().int().min(5).max(200),
        },
    }, async ({ sessionId, cols, rows }) => {
        const { terminal } = await resolveTerminal(ctx, sessionId);
        terminal.resize(cols, rows);
        SessionManager.recordResize(sessionId, cols, rows);
        return { cols, rows };
    });

    define("run_command", {
        confirm: true,
        title: "Run a non-interactive command over SSH",
        description: "Runs a command on the server of an SSH session in a separate non-interactive exec channel and returns stdout, stderr and the exit code. "
            + "This does not touch the interactive shell of the session. Commands using sudo are authenticated with the session identity's password automatically; "
            + "sudo works when this command runs it, but not when another program starts it, such as xargs sudo. "
            + "Prefer this over terminal_run for scripts and anything that needs a reliable exit code.",
        inputSchema: {
            sessionId: z.uuid().describe("An SSH session (open_session on an SSH entry)."),
            command: z.string(),
            timeoutSeconds: z.number().int().positive().max(1800).optional().describe("Default 300."),
        },
    }, async ({ sessionId, command, timeoutSeconds = 300 }) => {
        const { entry, protocol } = await ctx.resolveSession(sessionId);
        if (protocol !== "ssh") throw new ToolError("run_command requires an SSH session; use terminal_run for other protocols", "wrong_session_kind");
        await ctx.waitForConnection(sessionId);

        const sftp = await getSFTPAgentClient(sessionId, entry, ctx.accountId);
        const password = usesSudo(command) ? await getSessionPassword(sessionId, entry, ctx.accountId).catch(() => null) : null;

        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_COMMAND, { command, sessionId, mode: "exec" });

        const mirror = mirrorCommand(sessionId, command);
        let result;
        try {
            result = await sftp.exec(
                password ? `${SUDO_SHIM}\n${command}` : command,
                timeoutSeconds * 1000,
                password ? `${password}\n` : null,
            );
        } catch (err) {
            mirror.failed(err);
            throw err;
        }
        mirror.done(result);
        const { stdout, stderr, exitCode } = result;
        return { exitCode, stdout: truncate(stdout), stderr: truncate(stderr) };
    });

    define("exec_command", {
        confirm: true,
        title: "Run a one-off command on an SSH entry",
        description: "Connects to an SSH entry, runs a single command and disconnects. No session is kept. Returns stdout, stderr and the exit code. Limited to about 30 seconds; use open_session + run_command for longer commands.",
        inputSchema: {
            entryId: z.number().int(),
            command: z.string(),
            identityId: z.number().int().optional(),
        },
    }, async ({ entryId, command, identityId }) => {
        const entry = await Entry.findByPk(entryId);
        if (!entry) throw new ToolError("Entry not found", "entry_not_found");
        ctx.assertEntryAllowed(entry);
        const access = await validateEntryAccess(ctx.accountId, entry, "Access denied", Permission.CONNECT_SSH);
        if (!access.valid) throw new ToolError("You do not have permission to connect to this entry", "forbidden");

        ctx.auditEntry(entry, AUDIT_ACTIONS.AGENT_COMMAND, { command, mode: "one-off" });

        const result = await execCommand(ctx.accountId, entryId, identityId || null, command);
        if (result?.code) throw new ToolError(result.message, "exec_failed");
        return { ...result, stdout: truncate(result.stdout), stderr: truncate(result.stderr) };
    });
};
