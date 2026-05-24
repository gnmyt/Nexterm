const path = require("node:path");
const fs = require("node:fs");
const db = require("../../utils/database");
const MigrationRunner = require("../../utils/migrationRunner");
const Account = require("../../models/Account");
const { table } = require("../utils");

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
