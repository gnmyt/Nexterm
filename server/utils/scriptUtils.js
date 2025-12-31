const escapeColons = (t) => t.replace(/:/g, "\\x3A");
const unescapeColons = (t) => t.replace(/\\x3A/g, ":");

const parseOptions = (str) => {
    const s = str.replace(/\\"/g, "\"");
    const opts = [];
    let cur = "", inQ = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "\"" && (i === 0 || s[i - 1] === " ")) inQ = true;
        else if (c === "\"" && inQ) { inQ = false; opts.push(cur.trim()); cur = ""; }
        else if (c === " " && !inQ) { if (cur.trim()) { opts.push(cur.trim()); cur = ""; } }
        else cur += c;
    }
    if (cur.trim()) opts.push(cur.trim());
    return opts;
};

const checkSudoPrompt = (output) => {
    const patterns = ["[sudo] password for", "Password:", "sudo: a password is required", "sudo: a terminal is required"];
    if (!patterns.some(p => output.includes(p))) return null;
    const m = output.match(/\[sudo\] password for ([^:]+):/);
    return { variable: "SUDO_PASSWORD", prompt: `Enter sudo password for ${m?.[1] || "user"}`, default: "", isSudoPassword: true, type: "password" };
};

const transformScript = (content) => {
    const esc = (t) => t.replace(/:/g, "\\x3A");
    let t = content
        .replace(/^(\s*)sudo(?!\s+-S)(\s+)/gm, "$1sudo -S$2")
        .replace(/^(\s*)@NEXTERM:STEP\s+"((?:\\.|[^"\\])*)"/gm, "$1echo \"NEXTERM_STEP:$2\"")
        .replace(/^(\s*)@NEXTERM:INPUT\s+(\S+)\s+"((?:\\.|[^"\\])*)"(?:\s+"((?:\\.|[^"\\]*)*)")?/gm, (_, i, v, p, d) =>
            `${i}echo "NEXTERM_INPUT:${v}:${esc(p)}:${d ? esc(d) : ""}" && read -r ${v}`)
        .replace(/^(\s*)@NEXTERM:SELECT\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, v, p, o) =>
            `${i}echo "NEXTERM_SELECT:${v}:${esc(p)}:${esc(o).replace(/"/g, "\\\"")}" && read -r ${v}`)
        .replace(/^(\s*)@NEXTERM:SELECT\s+(\S+)\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, v, p, o) =>
            `${i}echo "NEXTERM_SELECT:${v}:${esc(p)}:${esc(o).replace(/"/g, "\\\"")}" && read -r ${v}`)
        .replace(/^(\s*)@NEXTERM:WARN\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "NEXTERM_WARN:${esc(m)}"`)
        .replace(/^(\s*)@NEXTERM:INFO\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "NEXTERM_INFO:${esc(m)}"`)
        .replace(/^(\s*)@NEXTERM:CONFIRM\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) =>
            `${i}echo "NEXTERM_CONFIRM:${esc(m)}" && read -r NEXTERM_CONFIRM_RESULT`)
        .replace(/^(\s*)@NEXTERM:PROGRESS\s+(\$?\w+|\d+)/gm, "$1echo \"NEXTERM_PROGRESS:$2\"")
        .replace(/^(\s*)@NEXTERM:SUCCESS\s+"((?:\\.|[^"\\])*)"/gm, (_, i, m) => `${i}echo "NEXTERM_SUCCESS:${esc(m)}"`)
        .replace(/^(\s*)@NEXTERM:SUMMARY\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, ti, d) =>
            `${i}echo "NEXTERM_SUMMARY:${esc(ti).replace(/"/g, "\\\"")}:${esc(d).replace(/"/g, "\\\"")}" && read -r NEXTERM_SUMMARY_RESULT`)
        .replace(/^(\s*)@NEXTERM:TABLE\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm, (_, i, ti, d) =>
            `${i}echo "NEXTERM_TABLE:${esc(ti).replace(/"/g, "\\\"")}:${esc(d).replace(/"/g, "\\\"")}" && read -r NEXTERM_TABLE_RESULT`)
        .replace(/^(\s*)@NEXTERM:MSGBOX\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"/gm, (_, i, ti, m) =>
            `${i}echo "NEXTERM_MSGBOX:${esc(ti)}:${esc(m)}" && read -r NEXTERM_MSGBOX_RESULT`);

    const script = `#!/bin/bash\nset -e\n${t}\n`;
    const b64 = Buffer.from(script).toString("base64");
    return `_script=$(mktemp) && echo '${b64}' | base64 -d > "$_script" && chmod +x "$_script" && "$_script"; _exit=$?; rm -f "$_script"; echo "NEXTERM_END:$_exit"`;
};

const stripAnsi = (s) => s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");

const findNextermCommand = (line) => {
    const clean = stripAnsi(line);
    if (clean.match(/echo\s+["']?NEXTERM_/i) || clean.trim().match(/^[$#>]\s+.*NEXTERM_/)) return null;
    const m = clean.match(/NEXTERM_(INPUT|SELECT|STEP|WARN|INFO|CONFIRM|PROGRESS|SUCCESS|SUMMARY|TABLE|MSGBOX|END):(.*)/s);
    return m ? { command: `NEXTERM_${m[1]}`, rest: m[2] } : null;
};

const processNextermLine = (line) => {
    const found = findNextermCommand(line);
    if (!found) return null;
    const { command, rest } = found;
    const parts = rest.split(":");
    const unescape = unescapeColons;

    switch (command) {
        case "NEXTERM_INPUT":
            return { type: "input", variable: parts[0], prompt: unescape(parts[1] || ""), default: parts[2] ? unescape(parts[2]) : "" };
        case "NEXTERM_SELECT": {
            const opts = parseOptions(unescape(parts.slice(2).join(":")));
            return { type: "select", variable: parts[0], prompt: unescape(parts[1] || ""), options: opts, default: opts[0] || "" };
        }
        case "NEXTERM_STEP": return { type: "step", description: rest.trim() };
        case "NEXTERM_WARN": return { type: "warning", message: unescape(rest) };
        case "NEXTERM_INFO": return { type: "info", message: unescape(rest) };
        case "NEXTERM_CONFIRM": return { type: "confirm", message: unescape(rest) };
        case "NEXTERM_PROGRESS": return { type: "progress", percentage: parseInt(rest.split(":")[0]) || 0 };
        case "NEXTERM_SUCCESS": return { type: "success", message: unescape(rest) };
        case "NEXTERM_SUMMARY": {
            const data = parseOptions(unescape(parts.slice(1).join(":")));
            return { type: "summary", title: unescape(parts[0] || ""), data };
        }
        case "NEXTERM_TABLE": {
            const data = parseOptions(unescape(parts.slice(1).join(":")));
            return { type: "table", title: unescape(parts[0] || ""), data };
        }
        case "NEXTERM_MSGBOX": return { type: "msgbox", title: unescape(parts[0] || ""), message: unescape(parts.slice(1).join(":")) };
        case "NEXTERM_END": return { type: "end", exitCode: parseInt(rest.trim()) || 0 };
        default: return null;
    }
};

module.exports = { escapeColons, unescapeColons, parseOptions, checkSudoPrompt, transformScript, stripAnsi, findNextermCommand, processNextermLine };