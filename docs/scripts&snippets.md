



# 📝 Creating Scripts & Snippets
> **Smart Organization** — Nexterm uses file extensions, not folder structure, to distinguish scripts from snippets. Design your repository however you like!

---

### Script Example: `10_largest_files.sh`
```sh
# @name: Largest files
# @description: A script to find the 10 largest files on the system.

find / -type f -exec ls -lh {} + | sort -k5 -h | tail -10
```

### Snippet Example : `system-update.snippet`
```txt
# @name: Quick IP Check
# @description: Display the current system IP address

ipconfig getifaddr en0
```

> **Unsure what to create?** Check out the [NexStore repository](https://github.com/gnmyt/NexStore/tree/main/nexterm) for real-world examples of scripts and snippets in action!

---

## 📋 Scripts vs Snippets

Nexterm intelligently differentiates scripts and snippets based on their **file extension**, not their location. This means you have complete freedom to organize your custom sources repository according to your own logic—whether by category, team, project, or any other structure that makes sense for your workflow.

---

## 📦 Supported Extensions

### 🔨 Snippets

Quick, reusable code blocks and commands:

| Extension | Use Case |
|-----------|----------|
| `.snippet` | Nexterm-native snippet format |
| `.txt` | Plain text snippets |
| `.cmd` | Windows batch commands |

### ⚙️ Scripts

Full executable scripts and automation:

| Extension | Shell Type |
|-----------|-----------|
| `.sh` | POSIX shell |
| `.bash` | Bash shell |
| `.zsh` | Z shell |
| `.fish` | Fish shell |
| `.ps1` | PowerShell |

---

## 🎯 Organization Best Practices

Since Nexterm recognizes files by extension rather than folder placement, you have ultimate flexibility in structuring your repository. Choose an approach that makes sense for your team and stick with it.

## ✨ Pro Tips

- **Mix & Match**: Combine different organization methods in the same repository
- **Consistency**: Choose an approach that makes sense for your team and stick with it
- **Extensions Are Key**: The file extension determines type—not the folder path
- **Flexibility**: Reorganize anytime without affecting Nexterm's ability to recognize your files
- **Naming**: Use clear, descriptive names for quick discovery across your repository
