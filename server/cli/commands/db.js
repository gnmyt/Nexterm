const path = require("node:path");
const fs = require("node:fs");
const { QueryTypes } = require("sequelize");
const db = require("../../utils/database");
const MigrationRunner = require("../../utils/migrationRunner");
const Account = require("../../models/Account");
const { table, requireConfirmation } = require("../utils");

const isSelect = (sql) => /^\s*(select|pragma|show|explain|with)\b/i.test(sql);
const isDestructive = (sql) => /^\s*(drop|truncate|delete|alter)\b/i.test(sql);

const execute = async (sql, { force } = {}) => {
    if (isDestructive(sql) && !force) {
        if (!await requireConfirmation(`destructive statement detected — execute?`)) {
            console.log("aborted");
            return;
        }
    }
    if (isSelect(sql)) {
        const rows = await db.query(sql, { type: QueryTypes.SELECT });
        if (!rows.length) { console.log("(no rows)"); return; }
        table(rows, Object.keys(rows[0]));
        console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
    } else {
        const [, meta] = await db.query(sql);
        const affected = typeof meta === "number" ? meta : (meta?.affectedRows ?? meta?.changes ?? "?");
        console.log(`ok (${affected} affected)`);
    }
};

module.exports.status = async () => {
    await db.authenticate();
    const runner = new MigrationRunner();
    await runner.ensureMigrationTable();
    const executed = await runner.getExecutedMigrations();
    const files = await runner.getMigrationFiles();
    const pending = files.filter((f) => !executed.includes(f));

    const adminCount = await Account.count({ where: { role: "admin" } });
    const userCount = await Account.count();

    console.log(`database:           ${process.env.DB_TYPE === "mysql" ? "mysql" : "sqlite"}`);
    if (process.env.DB_TYPE !== "mysql") {
        const storage = path.join(process.cwd(), "data", "nexterm.db");
        const stat = fs.existsSync(storage) ? fs.statSync(storage) : null;
        console.log(`sqlite file:        ${storage}${stat ? ` (${(stat.size / 1024).toFixed(1)} KiB)` : " (not yet created)"}`);
    }
    console.log(`migrations applied: ${executed.length} / ${files.length}`);
    console.log(`migrations pending: ${pending.length}`);
    console.log(`accounts:           ${userCount} (${adminCount} admin)`);

    if (pending.length > 0) {
        console.log("");
        console.log("pending migrations:");
        table(pending.map((f) => ({ file: f })), ["file"]);
    }
};

module.exports.migrate = async () => {
    await db.authenticate();
    const runner = new MigrationRunner();
    await runner.runMigrations();
    console.log("migrations up to date");
};

module.exports.query = async (sql, opts) => {
    await db.authenticate();
    const input = sql === "-" ? fs.readFileSync(0, "utf8") : sql;
    await execute(input, { force: opts.force });
};

module.exports.tables = async () => {
    await db.authenticate();
    const qi = db.getQueryInterface();
    const names = await qi.showAllTables();
    table(names.map((t) => ({ table: typeof t === "string" ? t : t.tableName })), ["table"]);
};

module.exports.schema = async (name) => {
    await db.authenticate();
    const cols = await db.getQueryInterface().describeTable(name);
    table(Object.entries(cols).map(([column, def]) => ({
        column,
        type: def.type,
        nullable: def.allowNull ? "yes" : "no",
        default: def.defaultValue ?? "",
        primary: def.primaryKey ? "yes" : "",
    })), ["column", "type", "nullable", "default", "primary"]);
};

