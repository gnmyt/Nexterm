const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const packageJson = require("../../../package.json");
const { createToolContext } = require("../agentTools/context");
const { registerMcpTools } = require("../agentTools/adapters");

const INSTRUCTIONS = `You are connected to a Nexterm instance (server management for SSH, Telnet, RDP, VNC, SFTP and Proxmox).
Every tool runs with the permissions of the account that owns the API key; actions are written to the audit log.

Typical workflow:
1. list_entries to find the server you need (optionally filter by protocol or name). get_entry shows details.
2. open_session with the entry id. The session runs in the background (desktop and Telnet / Proxmox console sessions are shown to the user as read-only tabs, SSH and file sessions are not shown) and stays open until close_session or an idle timeout.
3. Depending on the session kind:
   - terminal (SSH, Telnet, Proxmox console): terminal_run types a command and returns its output. terminal_send / terminal_read drive interactive programs. SSH sessions additionally offer run_command (separate exec channel with exit code) and the file_* tools.
   - desktop (RDP, VNC, Proxmox VM, remote browser): desktop_screenshot shows the screen; desktop_click, desktop_type, desktop_key, desktop_scroll and desktop_drag interact with it. Always take a screenshot after interacting to verify the result. Coordinates are display pixels (see the scale reported with each screenshot).
   - files (SFTP): file_list, file_read, file_write, file_edit, file_mkdir, file_delete, file_move, file_chmod.
4. close_session when you are done.

exec_command runs a single command on an SSH entry without keeping a session open.

To copy whole files between your machine and a server (binaries, archives, anything larger than a few KB), use transfer_create instead of file_write / file_read: it returns a single-use HTTPS link that you upload to or download from with curl in your own shell. transfer_status returns the byte count and sha256 afterwards.`;

const createMcpServer = ({ user, apiKey, ipAddress, userAgent, baseUrl = null }) => {
    const server = new McpServer(
        { name: "nexterm", version: packageJson.version },
        { instructions: INSTRUCTIONS },
    );
    const ctx = createToolContext({ user, apiKey, origin: "mcp", ipAddress, userAgent, baseUrl });
    registerMcpTools(server, ctx);
    return server;
};

module.exports = { createMcpServer };
