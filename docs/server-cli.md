# Server CLI

`ntctl` is the server-side admin CLI. It talks directly to the same database the Nexterm server uses, so it can do
things the web UI cannot: recover a locked-out admin, switch auth providers when SSO is broken, inspect migrations,
or run a quick SQL query.

It is not the same tool as `nt`, which is the end-user CLI for connecting to servers. `ntctl` is meant to be run
on the machine that hosts the Nexterm server.

## Installation

If you run Nexterm from source, `ntctl` is already there. The `bin` entry in `package.json` exposes it once you've
installed dependencies:

```sh
npx ntctl --help
```

If you'd rather call it without `npx`:

```sh
npm link
ntctl --help
```

The Docker image ships `ntctl` as `/usr/local/bin/ntctl`, so you can run it inside a running container:

```sh
docker exec -it nexterm ntctl user:list
```

## How it finds your data

`ntctl` needs the same `ENCRYPTION_KEY` the server uses, otherwise it can't read encrypted columns. It looks for it
in this order:

1. The `ENCRYPTION_KEY` environment variable.
2. A `.env` file in the data directory.
3. A Docker secret (`/run/secrets/encryption_key` or similar, handled by the existing `secrets` loader).
4. `data/encryption.key` relative to the working directory.

If you keep your data somewhere other than the current directory, pass `--data-dir`:

```sh
ntctl --data-dir /var/lib/nexterm user:list
```

This works whether the path points at the data directory itself or its parent. Internally it makes sure the runtime
sees a `data/` folder in the working directory, which is what the server expects.

## Command groups

Commands are grouped by area, using a colon separator (`user:list`, `auth:enable`, `db:status`). Typing just the
group name prints the commands in that group:

```sh
ntctl user
ntctl auth
ntctl db
```

`ntctl --help` shows everything at once.

## User management

### Listing accounts

```sh
ntctl user:list
```

Prints id, username, full name, role, and whether TOTP is enabled.

### Creating an account

```sh
ntctl user:create alice --admin
```

Without `--password`, you'll be prompted for the password interactively (with confirmation). For scripted use, pass
it directly:

```sh
ntctl user:create alice --password "hunter2" --first-name Alice --admin
```

Flags:

| Flag           | Description                                |
|----------------|--------------------------------------------|
| `--password`   | Password value. If omitted, prompts.       |
| `--first-name` | Defaults to the username if not provided.  |
| `--last-name`  | Defaults to empty.                         |
| `--admin`      | Creates the account with the admin role.   |

### Resetting a password

```sh
ntctl user:reset-password alice
```

Useful when an admin forgot their password and no other admin can reset it from the UI. Existing sessions stay valid
until they expire; `ntctl` does not force a logout.

### Promoting and demoting

```sh
ntctl user:promote alice
ntctl user:demote alice
```

Demoting the last remaining admin is refused; you'd be locking yourself out.

### Deleting an account

```sh
ntctl user:delete alice
```

Removes the account and all of its owned data (folders, identities, sessions), the same cascade the controller does
when an admin deletes a user from the UI.

## Authentication providers

When SSO is misconfigured and nobody can log in, this is the way back. `auth:list` shows the current state:

```sh
ntctl auth:list
```

Each row has a `kind` (`internal`, `ldap`, or `oidc`), an id, a name, and whether it's enabled.

### Switching providers

```sh
ntctl auth:enable internal
ntctl auth:enable my-ldap
ntctl auth:enable 3
```

`enable` is exclusive: it turns the chosen provider on and turns everything else off. Use `internal` (or its alias
`local`) for the built-in username/password login. For LDAP, you can use the provider name or its numeric id.

```sh
ntctl auth:disable my-ldap
ntctl auth:disable internal
```

`disable` is non-exclusive. The CLI refuses to disable internal auth if no other provider is enabled, and if you
disable the last enabled non-internal provider, it re-enables internal auth automatically so the instance is never
left without a login method.

After enabling or disabling providers, restart the server so the in-memory provider caches refresh.

## Database

### Status

```sh
ntctl db:status
```

Shows the database type, the SQLite file path and size (when applicable), how many migrations have been applied vs.
pending, and the account counts. If migrations are pending, they're listed.

### Running migrations

```sh
ntctl db:migrate
```

Applies any pending migrations. Same code path the server uses on startup, useful if you want to run migrations
explicitly before starting the server, or in a CI step.

### Inspecting schema

```sh
ntctl db:tables
ntctl db:schema accounts
```

`db:tables` lists every table. `db:schema <table>` prints the columns with their type, nullability, default value,
and whether they're part of the primary key.

### Running SQL

```sh
ntctl db:query "SELECT id, username, role FROM accounts WHERE role = 'admin'"
```

`SELECT`, `PRAGMA`, `SHOW`, `EXPLAIN`, and `WITH` statements print their results as a table. Everything else prints
the number of affected rows.

You can also pipe SQL in from stdin or a file:

```sh
cat patch.sql | ntctl db:query -
ntctl db:query - < patch.sql
```

Statements that start with `DROP`, `TRUNCATE`, `DELETE`, or `ALTER` prompt for confirmation before running. Pass
`--force` if you're confident and want to skip the prompt (for example in a script):

```sh
ntctl db:query --force "DELETE FROM audit_logs WHERE createdAt < '2024-01-01'"
```

The query runs through Sequelize, so it works the same way against SQLite and MySQL.
