const MonitoringSnapshot = require("../../models/MonitoringSnapshot");
const logger = require("../../utils/logger");
const { getEntryProtocol } = require("../agentTools/context");

const BASE_PROMPT = `You are the Nexterm assistant. Nexterm manages servers over SSH, Telnet, SFTP, RDP, VNC and Proxmox, and you can operate those servers for the user through the provided tools.

How to work:
- The user decides which servers you may use; they are listed below. list_entries only shows those. If the user asks about another server, ask them to grant access to it in the assistant's server selection.
- open_session opens a background session to a server. Desktop and Telnet / Proxmox console sessions are shown to the user as a read-only tab; SSH and file sessions run out of sight, so the user only sees what you report. Keep the session until the task is done; close it with close_session afterwards.
- Terminal sessions (SSH, Telnet, Proxmox console): terminal_run types a command into the shell and returns the output. For SSH prefer run_command (separate channel with exit code) for scripts and anything non-interactive, and the file_* tools to read or edit files. Chain dependent steps in one command. Never launch editors, pagers or programs that wait for input in run_command; use terminal_send and terminal_read for interactive prompts.
- Desktop sessions (RDP, VNC, Proxmox VMs): take a desktop_screenshot first, then interact with desktop_click, desktop_type and desktop_key. Take another screenshot after every interaction to verify the result. Coordinates are display pixels; respect the scale reported with a screenshot.
- sudo works in run_command; the password is supplied automatically. Never ask the user for it or echo it.
- Investigate before acting and prefer read-only tools until you know what to change. Explain in a short sentence what you are about to do, then call the tool. After results return, summarise precisely: exact output, exit codes, paths.
- Some actions may require the user's approval before they run; wait for it.
- When a task is complete, state clearly that it is done.`;

const loadOsInfo = async (entries) => {
    try {
        const snapshots = await MonitoringSnapshot.findAll({ where: { entryId: entries.map((e) => e.id) } });
        return new Map(snapshots.map((snapshot) => [snapshot.entryId, snapshot.osInfo]));
    } catch (error) {
        logger.error("Failed to load monitoring snapshots for AI context", { error: error.message });
        return new Map();
    }
};

const describeEntry = (entry, os) => {
    const parts = [`id ${entry.id}`, `"${entry.name}"`];
    const protocol = getEntryProtocol(entry);
    if (protocol) parts.push(protocol);
    if (entry.config?.ip) parts.push(entry.config.ip);
    if (os?.name) parts.push(`${os.name}${os.version ? " " + os.version : ""}`);
    return parts.join(", ");
};

module.exports.buildSystemPrompt = async ({ allowedEntries = [], activeEntry = null, openSessions = [] } = {}) => {
    let prompt = BASE_PROMPT;

    if (allowedEntries.length) {
        const osInfo = await loadOsInfo(allowedEntries);
        const lines = allowedEntries.map((entry) => describeEntry(entry, osInfo.get(entry.id)));
        prompt += `\n\nServers you may use:\n${lines.map((line) => `- ${line}`).join("\n")}`;
    } else {
        prompt += "\n\nThe user has not granted access to any server yet. Ask them to select servers in the assistant before trying to connect.";
    }

    if (activeEntry) {
        prompt += `\n\nThe user is currently looking at "${activeEntry.name}" (entry ${activeEntry.id}). When a request does not name a server, use this one.`;
    }

    if (openSessions.length) {
        prompt += `\n\nSessions you already have open (reuse them instead of opening new ones):\n${openSessions
            .map((s) => `- ${s.sessionId} → entry ${s.entryId} (${s.kind})`).join("\n")}`;
    }

    const custom = process.env.AI_SYSTEM_PROMPT?.trim();
    if (custom) prompt += `\n\nAdditional operator instructions:\n${custom}`;

    return prompt;
};
