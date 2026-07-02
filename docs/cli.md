# ⌨️ CLI

The Nexterm CLI (`nt`) lets you connect to your servers straight from the terminal – no browser needed. It uses the same
authentication and entry system as the web UI, so all your servers, folders, and identities are already there.

This is useful when you just want to quickly SSH into a machine without opening the web interface, or when you need to
run a one-off command on a remote server from a script or CI pipeline.

## Installation

### Step 1: Download/Build the CLI

#### Recommended Option: Download the latest binary

Download the file for your OS:

| Platform | x86-64 | ARM64 |
|----------|--------|-------|
| Windows  | [nt.exe](https://github.com/gnmyt/Nexterm/releases/latest/download/nt-windows-x64.exe) | |
| macOS    | | [nt](https://github.com/gnmyt/Nexterm/releases/latest/download/nt-macos-arm64) |
| Linux    | [nt](https://github.com/gnmyt/Nexterm/releases/latest/download/nt-linux-x64) | [nt](https://github.com/gnmyt/Nexterm/releases/latest/download/nt-linux-arm64) |

> Additional platforms may be supported by the time you read this. Check the [latest release](https://github.com/gnmyt/Nexterm/releases/latest) under the CLI section for the full list.

#### Alternative Option: Build the CLI from source (requires [Rust](https://www.rust-lang.org/tools/install))

```sh
git clone https://github.com/gnmyt/Nexterm.git
cd Nexterm/cli
cargo build --release
```

The binary will be located at `cli/target/release/nt`.

### Step 2: Add it to your PATH

Move the binary to a folder that's included in your system's `PATH` (create the folder first if it doesn't exist yet), then make sure it's executable and available from anywhere.

| OS | Recommended location | Commands |
|----|----------------------|----------|
| **Windows** | `C:\Tools` | ```powershell mkdir C:\Tools -Force; Move-Item nt.exe C:\Tools\nt.exe; setx PATH "$($env:PATH);C:\Tools"``` |
| **macOS** | `/usr/local/bin` | ```sh chmod +x nt; sudo mv nt /usr/local/bin/nt``` |
| **Linux (Ubuntu/Debian)** | `/usr/local/bin` | ```sh chmod +x nt; sudo mv nt /usr/local/bin/nt``` |

> On Windows, `setx` only takes effect in **new** terminal sessions — restart your terminal (or your PC) afterward.
> On macOS/Linux, `/usr/local/bin` is on `PATH` by default, so no manual `PATH` edit is needed there.

Verify the installation:

```sh
nt --version
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
PVE LXC, PVE Shell) are shown.

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

### Port Forwarding

```sh
nt forward <server> --local 8080 --port 3000
```

Lets you access a remote port on your local machine, similar to `ssh -L`. In this example, the server's port `3000`
becomes available at `127.0.0.1:8080` on your machine.

By default, the remote host is `127.0.0.1` (the server itself). You can forward to a different host on the server's
network:

```sh
nt forward my-server --local 5432 --remote 10.0.0.5 --port 5432
```

This is useful for accessing databases, internal services, or admin panels that aren't directly exposed. The tunnel
stays open until you press `Ctrl+C`.

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
