# 🤖 MCP Server

Nexterm has a built-in [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets AI agents like
Claude Code, Cursor or any other MCP client work with your servers through Nexterm: look up entries, open sessions, run
commands, edit files and even operate remote desktops.

## Why?

Your agent probably can't reach your servers on its own, and even if it could, you'd have to hand it SSH keys and
passwords. With the MCP server, the agent goes through Nexterm instead. It sees the same entries you do, logs in with the
identities you already have, and never gets to see a credential.

Everything an agent does runs with the permissions of the account that owns the API key and ends up in the audit log.

## Connecting an Agent

Create an API key under **Settings** → **Account** → **API Keys**, then point your client at
`https://<your-nexterm>/api/mcp` with the key as a bearer token.

For Claude Code:

```sh
claude mcp add --transport http nexterm https://nexterm.example.com/api/mcp \
  --header "Authorization: Bearer nxt_..."
```

For clients that use an `mcp.json` file (Cursor, Claude Desktop, …):

```json
{
  "mcpServers": {
    "nexterm": {
      "type": "http",
      "url": "https://nexterm.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer nxt_..."
      }
    }
  }
}
```

The server uses the Streamable HTTP transport and is stateless, so only `POST` requests are needed.

## Watching the Agent

When an agent connects to a server, it opens its own session. These sessions are view-only: nobody can type into them,
not even you.

Terminal (SSH, Telnet, Proxmox console) and remote desktop (RDP, VNC, Proxmox VM) sessions show up as tabs with a soft
glow around the edges, so you can follow along while the agent works. On SSH, commands the agent runs in the background
and file changes are printed into the terminal as well. The agent also appears next to the tab title and spins while
it's busy.

Don't want the extra tabs? Turn off **Show sessions opened by the AI assistant or MCP agents** under **Settings** →
**Account**. Pure SFTP and remote browser sessions are never shown.

Sessions stay open between tool calls, so an agent can `cd` into a directory and keep working there. They're closed
when the agent is done, or automatically after 60 minutes of inactivity. Closing the tab ends the session too.

> [!TIP]
> Organization members with access to **Live Sessions** can watch agent sessions there as well.

## What Agents Can Do

### Find servers

`list_entries` returns every entry the account can access, with protocol, folder, organization, identities and tags. It
can be filtered by name, protocol or organization. `get_entry` returns the full configuration of one entry, without
credentials.

There are also lists for folders, organizations, identities, snippets, scripts, tags and users, plus
`get_permissions`, `get_monitoring` and `list_sessions`.

### Open sessions

`open_session` connects to an entry and returns a session id along with what kind of session it is: `terminal`,
`desktop` or `files`. Agents can pick an identity, open an SSH entry as `sftp`, open the remote browser with `web`,
pass a connection reason and set the desktop resolution. `close_session` and `close_all_sessions` clean up afterwards.

### Use a terminal

| Tool              | What it does                                                                                        |
|-------------------|-----------------------------------------------------------------------------------------------------|
| `terminal_run`    | Types a command into the shell and returns the output. On SSH, the exit code is captured as well.   |
| `terminal_send`   | Sends text and keys like `enter`, `ctrl-c`, arrows or F-keys, for prompts and interactive programs. |
| `terminal_read`   | Returns new output and the end of the screen.                                                       |
| `terminal_resize` | Changes the terminal size.                                                                          |
| `run_command`     | Runs a command over a separate SSH channel and returns stdout, stderr and the exit code.            |
| `exec_command`    | Runs a single command on an SSH entry without keeping a session open.                               |

`run_command` is the most reliable way to run scripts. If a command uses `sudo`, Nexterm supplies the identity's
password.

### Work with files

On SSH and SFTP sessions, agents can list, read, write, edit, move, delete and `chmod` files and create directories.

### Operate a desktop

| Tool                                                                    | What it does                                        |
|-------------------------------------------------------------------------|-----------------------------------------------------|
| `desktop_screenshot`                                                    | Returns the current screen as an image.             |
| `desktop_click`, `desktop_mouse_move`, `desktop_drag`, `desktop_scroll` | Mouse input.                                        |
| `desktop_type`, `desktop_key`                                           | Typing and key combinations like `ctrl+alt+delete`. |
| `desktop_resize`                                                        | Changes the resolution.                             |
| `desktop_clipboard_set`, `desktop_clipboard_get`                        | Reads and writes the remote clipboard.              |
| `desktop_info`                                                          | Screen size, mouse position and clipboard content.  |

Screenshots are rendered by Nexterm itself, so the agent sees exactly what you'd see without needing a browser.

### Batch calls

`batch` runs several tool calls in one request, one after another or in parallel. It's handy for chains like click,
type, press Enter, take a screenshot, or for running the same command on several servers at once.

## Auditing

Agent actions get their own entries in the audit log: `agent.command`, `agent.terminal_input`, `agent.desktop_input`,
`agent.screenshot` and `agent.file_*`. Each one records which API key was used, and the connection entry of an agent
session is marked as automated.

Organizations can turn this category on or off with **AI Agent Operations** in their audit settings.

> [!NOTE]
> Text typed on a desktop is never stored, only its length. Terminal input the agent marks as sensitive, such as a
> password, is redacted.
