#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Command } = require("commander");

const setupWorkingDirectory = (dataDir) => {
    if (!dataDir) return;
    const resolved = path.resolve(dataDir);
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
    if (path.basename(resolved) === "data") {
        process.chdir(path.dirname(resolved));
        return;
    }
    const stub = fs.mkdtempSync(path.join(os.tmpdir(), "ntctl-"));
    const link = path.join(stub, "data");
    fs.symlinkSync(resolved, link, "dir");
    process.chdir(stub);
    process.on("exit", () => { try { fs.unlinkSync(link); fs.rmdirSync(stub); } catch {} });
};

const loadEnv = () => {
    try { require("../utils/secrets").loadSecrets(); } catch {}
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
            if (!m || process.env[m[1]]) continue;
            process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
        }
    }
    if (!process.env.ENCRYPTION_KEY) {
        const keyFile = path.join(process.cwd(), "data", "encryption.key");
        if (fs.existsSync(keyFile)) process.env.ENCRYPTION_KEY = fs.readFileSync(keyFile, "utf8").trim();
    }
};

const run = (group, handlerName) => async (...args) => {
    const opts = args[args.length - 2];
    const cmd = args[args.length - 1];
    setupWorkingDirectory(cmd.optsWithGlobals().dataDir);
    loadEnv();
    if (!process.env.ENCRYPTION_KEY) {
        console.error("error: ENCRYPTION_KEY not found. Set it via env.");
        process.exit(2);
    }
    process.env.LOG_LEVEL = process.env.LOG_LEVEL || "error";
    let code = 0;
    try {
        const handler = require(`./commands/${group}`)[handlerName];
        await handler(...args.slice(0, -2), opts);
    } catch (err) {
        console.error(`error: ${err.message || err}`);
        if (process.env.NTCTL_DEBUG) console.error(err.stack);
        code = 1;
    }
    await require("../utils/database").close().catch(() => {});
    process.exit(code);
};

const program = new Command();
program
    .name("ntctl")
    .description("Nexterm server admin CLI")
    .option("--data-dir <path>", "path to Nexterm data directory")
    .enablePositionalOptions();

const pwOpts = (cmd) => cmd.option("--password <s>", "password value (prompts interactively if omitted)");

const groups = {
    user: {
        description: "manage local accounts",
        commands: [
            ["list", "list all accounts"],
            ["create <username>", "create a local account", "create", (c) => pwOpts(c)
                .option("--first-name <s>", "first name")
                .option("--last-name <s>", "last name")
                .option("--admin", "grant admin role")],
            ["reset-password <username>", "reset password for an account", "resetPassword", pwOpts],
            ["promote <username>", "grant admin role"],
            ["demote <username>", "revoke admin role"],
            ["delete <username>", "delete account", "remove"],
        ],
    },
    auth: {
        description: "manage authentication providers",
        commands: [
            ["list", "list providers and enabled state"],
            ["enable <selector>", "enable provider by id, name, or 'internal'/'local' (disables others)"],
            ["disable <selector>", "disable provider (re-enables local if none left)"],
        ],
    },
    db: {
        description: "database and migration utilities",
        commands: [
            ["status", "show migration state and user counts"],
            ["migrate", "apply pending migrations"],
            ["tables", "list all tables"],
            ["schema <table>", "describe table columns"],
            ["query <sql>", "execute a SQL statement (use '-' to read from stdin)", "query",
                (c) => c.option("--force", "skip confirmation for destructive statements")],
        ],
    },
};

const handlerName = (signature, override) => override || signature.split(/\s+/)[0].replace(/-([a-z])/g, (_, c) => c.toUpperCase());

for (const [group, { description, commands }] of Object.entries(groups)) {
    for (const [signature, desc, override, configure] of commands) {
        const cmd = program.command(`${group}:${signature}`).description(desc);
        if (configure) configure(cmd);
        cmd.action(run(group, handlerName(signature, override)));
    }
    program.command(group).description(description).action(() => {
        const entries = commands.map(([sig, d]) => [`${group}:${sig}`, d]);
        const pad = entries.reduce((w, [s]) => Math.max(w, s.length), 0);
        console.log(`${description}\n\nAvailable commands:`);
        for (const [sig, d] of entries) console.log(`  ${sig.padEnd(pad)}  ${d}`);
    });
}

program.parseAsync(process.argv);