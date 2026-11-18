const { z } = require("zod");
const { ToolError, getEntryProtocol, describeSessionKind } = require("../context");
const { createSession } = require("../../../controllers/serverSession");
const { createSFTPConnectionForSession } = require("../../ConnectionService");
const SessionManager = require("../../SessionManager");
const Entry = require("../../../models/Entry");
const { sessionSummary } = require("./discovery");

const KIND_HINTS = {
    terminal: "Use terminal_run to execute commands and terminal_read / terminal_send for interactive programs. SSH sessions also support run_command (non-interactive, returns exit code) and the file_* tools.",
    desktop: "Use desktop_screenshot to look at the screen, then desktop_click, desktop_type and desktop_key to interact. Coordinates are in display pixels of the screenshot.",
    files: "Use the file_* tools (file_list, file_read, file_write, ...) to work with the remote filesystem.",
};

module.exports = (define, ctx) => {
    define("open_session", {
        title: "Open a background session",
        description: "Opens a persistent background session to an entry (SSH, Telnet, RDP, VNC, SFTP, Proxmox console/VM). "
            + "The session is marked as automated: nobody can type into it, and the user can watch desktop and terminal sessions in the Nexterm UI (on SSH, run_command and file_* activity is shown in the terminal too; pure SFTP and web sessions run out of sight). It stays open until close_session is called or it is idle for too long. "
            + "Returns the sessionId to pass to the terminal_*, file_* and desktop_* tools.",
        inputSchema: {
            entryId: z.number().int().describe("Entry id from list_entries."),
            identityId: z.number().int().optional().describe("Identity to log in with (default: the entry's default identity)."),
            type: z.enum(["terminal", "sftp", "web"]).optional().describe("Force a session type: 'sftp' opens a pure file-transfer session on an SSH entry, 'web' opens the remote browser. Default: the entry's native protocol."),
            connectionReason: z.string().max(500).optional().describe("Reason for the connection; required by some organizations for auditing."),
            displayWidth: z.number().int().min(640).max(3840).optional().describe("Desktop width in pixels for RDP/VNC sessions (default 1280)."),
            displayHeight: z.number().int().min(480).max(2160).optional().describe("Desktop height in pixels for RDP/VNC sessions (default 800)."),
            waitForReady: z.boolean().optional().describe("Wait until the connection is established before returning (default true)."),
            timeoutSeconds: z.number().int().positive().max(180).optional().describe("How long to wait for the connection (default 45)."),
        },
    }, async ({ entryId, identityId, type, connectionReason, displayWidth, displayHeight, waitForReady = true, timeoutSeconds = 45 }) => {
        const entry = await Entry.findByPk(entryId);
        if (!entry) throw new ToolError("Entry not found", "entry_not_found");
        ctx.assertEntryAllowed(entry);

        const protocol = getEntryProtocol(entry);
        const sessionType = type === "sftp" || type === "web" ? type : null;
        const isDesktop = describeSessionKind(entry, { type: sessionType }) === "desktop";

        const result = await createSession({
            accountId: ctx.accountId,
            entryId,
            identityId: identityId || null,
            connectionReason: connectionReason || null,
            type: sessionType,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            automated: true,
            origin: ctx.origin,
            apiKeyId: ctx.apiKey?.id || null,
            displayWidth: isDesktop ? (displayWidth || 1280) : null,
            displayHeight: isDesktop ? (displayHeight || 800) : null,
        });
        if (result?.code) throw new ToolError(result.message, "open_failed");

        const { sessionId } = result;
        const session = SessionManager.get(sessionId);
        const kind = describeSessionKind(entry, session?.configuration || { type: sessionType });

        if (waitForReady) {
            try {
                if (kind === "files") await createSFTPConnectionForSession(sessionId, entry, ctx.accountId);
                await ctx.waitForConnection(sessionId, timeoutSeconds * 1000);
            } catch (err) {
                await SessionManager.remove(sessionId).catch(() => {});
                throw new ToolError(err.message, "connection_failed");
            }
        }
        return {
            sessionId,
            entryId,
            entryName: entry.name,
            protocol,
            kind,
            status: SessionManager.getConnection(sessionId) ? "connected" : "connecting",
            hint: KIND_HINTS[kind] || null,
        };
    });

    define("get_session", {
        title: "Get session status",
        description: "Returns the status of a session opened with open_session (or an interactive session of the account).",
        inputSchema: { sessionId: z.uuid() },
        annotations: { readOnlyHint: true },
    }, async ({ sessionId }) => sessionSummary(ctx.requireSession(sessionId)));

    define("close_session", {
        title: "Close a session",
        description: "Closes a background session and disconnects from the remote host.",
        inputSchema: { sessionId: z.uuid() },
        annotations: { destructiveHint: true },
    }, async ({ sessionId }) => {
        ctx.requireSession(sessionId);
        await SessionManager.remove(sessionId);
        return { sessionId, closed: true };
    });

    define("close_all_sessions", {
        title: "Close all background sessions",
        description: "Closes every automated session this agent opened for this account. Interactive sessions in the UI are not affected.",
        annotations: { destructiveHint: true },
    }, async () => {
        const sessions = SessionManager.getAutomated(ctx.accountId).filter((s) => ctx.canUseSession(s));
        await Promise.all(sessions.map((session) => SessionManager.remove(session.sessionId)));
        return { closed: sessions.length };
    });
};
