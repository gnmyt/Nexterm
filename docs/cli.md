# ⌨️ CLI

The Nexterm CLI (`nt`) lets you connect to your servers straight from the terminal — no browser needed. It uses the same
authentication and entry system as the web UI, so all your servers, folders, and identities are already there.

This is useful when you just want to quickly SSH into a machine without opening the web interface, or when you need to
run a one-off command on a remote server from a script or CI pipeline.

## Installation

Build the CLI from source (requires Rust):

```sh
cd cli
cargo build --release
```

The binary will be at `cli/target/release/nt`. Move it somewhere in your `$PATH`:

```sh
cp cli/target/release/nt /usr/local/bin/
```

## Getting Started

First, log in to your Nexterm server:

```sh
nt login
```

You'll be prompted for the server URL and can choose between entering a one-time code in the web UI or opening the
browser directly. Once authenticated, the session is saved locally and you're good to go.

## Commands

### Listing Servers

```sh
nt ls
```

Shows all your servers in a tree, just like the sidebar in the web UI. Only terminal-based entries (SSH, Telnet,
PVE LXC, PVE Shell) are shown — RDP and VNC entries are skipped since they don't make sense in a terminal context.

You can filter by folder or tag:

```sh
nt ls --folder "Home-Lab"
nt ls --tag "production"
```

Or get the raw data as JSON:

```sh
nt ls --json
```

### Connecting to a Server

```sh
nt connect <server>
```

The `<server>` argument can be a numeric entry ID (like `#8` from `nt ls`), an exact name, or even a partial name —
the CLI will fuzzy-match it for you. If the entry has multiple identities attached, you'll be asked to pick one.

To run a single command instead of opening an interactive session:

```sh
nt connect my-server -- uptime
```

The command's stdout and stderr are printed directly, and the exit code is forwarded. This makes it easy to use in
scripts:

```sh
nt connect 8 -- "df -h" | grep /dev/sda1
```

### Searching

```sh
nt search "mail"
```

Fuzzy-searches across all your servers by name and IP address, then lets you pick one from the results to connect to.
The results are ranked by match quality and presented as an interactive list.

You can also pass a command to run on the selected server:

```sh
nt search "gateway" -- "systemctl status nginx"
```

### Quick Connect

```sh
nt recent
```

Shows all your servers in a list and lets you pick one to connect to. Handy when you don't remember the exact name
or ID but want to browse through everything quickly.

## Configuration

```sh
nt config show
```

The CLI stores its configuration in `~/.config/nexterm/config.json`. You can view or change individual settings:

```sh
nt config set server-url https://nexterm.example.com
nt config get server-url
```

| Key                    | Description                                           |
|------------------------|-------------------------------------------------------|
| `server-url`           | The URL of your Nexterm server                        |
| `accept-invalid-certs` | Set to `true` to allow self-signed SSL certificates   |

### Logging Out

```sh
nt logout
```

Clears the stored session token. You'll need to run `nt login` again to reconnect.
