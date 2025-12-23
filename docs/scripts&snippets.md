



# 📝 Scripts & Snippets

Nexterm uses file extensions to distinguish scripts from snippets, not folder structure. This means you can organize your repository however you like.

## Scripts vs Snippets

**Scripts** are full executable files that run on the server. Use them to automate tasks like system maintenance, deployments, or batch operations.

**Snippets** are quick commands you can paste into your terminal session. They're useful for frequently used commands you don't want to type out every time.

## Supported Extensions

**Snippets:** `.snippet`, `.txt`, `.cmd`

**Scripts:** `.sh`, `.bash`, `.zsh`, `.fish`, `.ps1`

## File Format

Both scripts and snippets use comments at the top to define their name and description:

```sh
# @name: Largest files
# @description: Find the 10 largest files on the system.

find / -type f -exec ls -lh {} + | sort -k5 -h | tail -10
```

The `@name` is what appears in the Nexterm UI, and `@description` provides additional context.

## Examples

**Script** (`10_largest_files.sh`):
```sh
# @name: Largest files
# @description: Find the 10 largest files on the system.

find / -type f -exec ls -lh {} + | sort -k5 -h | tail -10
```

**Snippet** (`quick-ip.snippet`):
```txt
# @name: Quick IP Check
# @description: Display the current system IP address

ipconfig getifaddr en0
```

> [!TIP]
> Check out the [NexStore repository](https://github.com/gnmyt/NexStore/tree/main/nexterm) for more examples.
