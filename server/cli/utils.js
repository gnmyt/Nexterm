const readline = require("node:readline");
const password = require("@inquirer/password").default;

const promptPassword = async (label = "Password") => {
    const a = await password({ message: `${label}:`, mask: "*" });
    const b = await password({ message: `${label} (confirm):`, mask: "*" });
    if (a !== b) throw new Error("passwords do not match");
    if (!a) throw new Error("password may not be empty");
    return a;
};

const promptLine = (prompt) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => { rl.close(); resolve(ans); });
});

const requireConfirmation = async (message) => {
    const ans = await promptLine(`${message} [y/N]: `);
    return /^y(es)?$/i.test(ans.trim());
};

const table = (rows, headers) => {
    if (rows.length === 0) { console.log("(none)"); return; }
    const cols = headers.map((h) => typeof h === "string" ? h : h.key);
    const labels = headers.map((h) => typeof h === "string" ? h : (h.label || h.key));
    const widths = labels.map((l, i) => Math.max(l.length, ...rows.map((r) => String(r[cols[i]] ?? "").length)));
    const line = (cells) => cells.map((c, i) => String(c ?? "").padEnd(widths[i])).join("  ");
    console.log(line(labels));
    console.log(widths.map((w) => "-".repeat(w)).join("  "));
    for (const r of rows) console.log(line(cols.map((c) => r[c])));
};

const restartHint = (msg = "restart the server so in-memory caches refresh") => console.log(`note: ${msg}`);

const throwOnControllerError = async (promise) => {
    const err = await promise;
    if (err) throw new Error(err.message);
};

const yn = (v) => v ? "yes" : "no";

module.exports = { promptPassword, promptLine, requireConfirmation, table, restartHint, throwOnControllerError, yn };
