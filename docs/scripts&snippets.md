



# 📝 Scripts & Snippets

Nexterm uses file extensions to distinguish scripts from snippets, not folder structure. This means you can organize your repository however you like.

## Scripts vs Snippets

**Scripts** are full executable files that run on the server. Use them to automate tasks like system maintenance, deployments, or batch operations.

**Snippets** are quick commands you can paste into your terminal session. They're useful for frequently used commands you don't want to type out every time.

## File Format

Both scripts and snippets use comments at the top to define metadata:

::: code-group

```sh [Script (.sh)]
# @name: Largest files
# @description: Find the 10 largest files on the system.
# @os: Ubuntu, Debian, Fedora

find / -type f -exec ls -lh {} + | sort -k5 -h | tail -10
```

```txt [Snippet (.snippet)]
# @name: Update packages
# @description: Update and upgrade all packages
# @os: Ubuntu, Debian

sudo apt update && sudo apt upgrade -y
```

```txt [Proxmox Snippet]
# @name: Backup all VMs
# @description: Create a backup of all running VMs
# @os: Proxmox VE

vzdump --all --mode snapshot --compress zstd
```

:::

## Supported Extensions

**Snippets:** `.snippet`, `.txt`, `.cmd`

**Scripts:** `.sh`, `.bash`, `.zsh`, `.fish`, `.ps1`

## Available Tags

| Tag | Description |
|-----|-------------|
| `@name` | Display name in the Nexterm UI |
| `@description` | Additional context about what the command does |
| `@os` | Comma-separated list of compatible operating systems |

## Supported OS Values

Use these exact values for the `@os` tag:

`Ubuntu`, `Debian`, `Alpine Linux`, `Fedora`, `CentOS`, `Red Hat`, `Rocky Linux`, `AlmaLinux`, `openSUSE`, `Arch Linux`, `Manjaro`, `Gentoo`, `NixOS`, `Proxmox VE`

> [!TIP]
> Snippets without an `@os` tag are shown on all systems. Use `Proxmox VE` for commands specific to PVE shell or LXC consoles.

> [!TIP]
> Check out the [NexStore repository](https://github.com/gnmyt/NexStore/tree/main/nexterm) for more examples.

### Scripting Variables & Directives

For advanced script functionality, including step tracking, user input collection, and real-time feedback, see the [📋 Scripting Variables & Directives](./ScriptingVariables.md) guide.
