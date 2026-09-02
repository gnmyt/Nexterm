# 🛡️ Admin Settings

## Users

Manage user accounts, roles, and permissions.

| Column | Description |
|---|---|
| User | Name and username |
| Role | Admin or standard user |
| 2FA | Whether two-factor authentication is enabled |

**Create New User** requires: First Name, Last Name, Username, Password.

**Per-user actions:** Change Password, Promote to Admin, Login as User, Delete User.

## Authentication

Configure how users sign in.

| Provider | Description |
|---|---|
| Internal Authentication | Username and password authentication |
| [OIDC Authentication](/oidc) | Single sign-on via an OIDC provider |
| [LDAP Authentication](/ldap) | Authenticate against an LDAP directory |

## Sources

External sources for syncing scripts, snippets, and themes.

| Source | Type | Snippets | Scripts | Themes |
|---|---|---|---|---|
| `source.nexterm.dev` | Official, Synced | 1 | 2 | 3 |

More about Sources: [Custom Sources](/customsource).

## Monitoring

### Status Checker

Checks whether servers are online or offline.

| Setting | Description |
|---|---|
| Enable Status Checker | If disabled, all servers are shown as online |
| Check Interval | 10–300 seconds |

### Data Collection

Collects CPU, memory, disk, and network metrics.

| Setting | Description |
|---|---|
| Enable Monitoring | Collect performance metrics from monitored servers |
| Collection Interval | 30–600 seconds |
| Data Retention | 1–24 hours |

### Advanced Settings

Fine-tune monitoring performance and resource usage.

| Setting | Description |
|---|---|
| Connection Timeout | Max wait time for a server response (5–120 seconds) |
| Batch Size | Servers checked simultaneously (1–50) |

## Engines

Manage engine instances that handle remote connections. See [Engines](/engines).

## Storage

### Disk Usage

| Category | Size |
|---|---|
| Database | 1.29 MB |
| Recordings | 0 B |
| Logs | 11.98 MB |
| **Total** | **13.28 MB** |

> Values shown are examples — actual sizes depend on your instance.

### Backups

Configure backup providers and schedules.

| Setting | Description |
|---|---|
| Automatic Backup | Schedule recurring backups |
| Retention Policy | How many backups are kept |
| Include in Backups | What data is included |
| Providers | No backup providers configured by default — add one to start creating backups |

## AI

AI-powered command generation for terminal sessions and snippet creation.

| Setting | Description |
|---|---|
| Enable AI Assistant | Allow users to generate commands using AI |
| AI Provider | Ollama, OpenAI, OpenAI-compatible (more may be added) |