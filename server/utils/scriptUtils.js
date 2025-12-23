module.exports.escapeColons = (text) => {
    return text.replace(/:/g, "\\x3A");
};

module.exports.unescapeColons = (text) => {
    return text.replace(/\\x3A/g, ":");
};

module.exports.parseOptions = (optionsStr) => {
    const unescapedOptions = optionsStr.replace(/\\"/g, "\"");

    const options = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < unescapedOptions.length; i++) {
        const char = unescapedOptions[i];

        if (char === "\"" && (i === 0 || unescapedOptions[i - 1] === " ")) {
            inQuotes = true;
        } else if (char === "\"" && inQuotes) {
            inQuotes = false;
            options.push(current.trim());
            current = "";
        } else if (char === " " && !inQuotes) {
            if (current.trim()) {
                options.push(current.trim());
                current = "";
            }
        } else {
            current += char;
        }
    }

    if (current.trim()) options.push(current.trim());

    return options;
};

module.exports.checkSudoPrompt = (output) => {
    const sudoPatterns = ["[sudo] password for", "Password:", "sudo: a password is required", "sudo: a terminal is required"];

    if (sudoPatterns.some(pattern => output.includes(pattern))) {
        const sudoMatch = output.match(/\[sudo\] password for ([^:]+):/);
        const username = sudoMatch ? sudoMatch[1] : "user";

        return {
            variable: "SUDO_PASSWORD",
            prompt: `Enter sudo password for ${username}`,
            default: "",
            isSudoPassword: true,
            type: "password",
        };
    }

    return null;
};

module.exports.transformScript = (scriptContent) => {
    let transformedContent = scriptContent;

    transformedContent = transformedContent.replace(
        /^(\s*)sudo(?!\s+-S)(\s+)/gm,
        "$1sudo -S$2");

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:STEP\s+"((?:\\.|[^"\\])*)"/gm,
        "$1echo \"NEXTERM_STEP:$2\"");

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:INPUT\s+(\S+)\s+"((?:\\.|[^"\\])*)"(?:\s+"((?:\\.|[^"\\]*)*)")?/gm,
        (match, indent, varName, prompt, defaultValue) => {
            const escapedPrompt = prompt.replace(/:/g, "\\x3A");
            const escapedDefault = defaultValue ? defaultValue.replace(/:/g, "\\x3A") : "";
            return `${indent}echo "NEXTERM_INPUT:${varName}:${escapedPrompt}:${escapedDefault}" && read -r ${varName}`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SELECT\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm,
        (match, indent, varName, prompt, options) => {
            const escapedPrompt = prompt.replace(/:/g, "\\x3A");
            const escapedOptions = options.replace(/:/g, "\\x3A").replace(/"/g, "\\\"");
            return `${indent}echo "NEXTERM_SELECT:${varName}:${escapedPrompt}:${escapedOptions}" && read -r ${varName}`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SELECT\s+(\S+)\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm,
        (match, indent, varName, prompt, options) => {
            const escapedPrompt = prompt.replace(/:/g, "\\x3A");
            const escapedOptions = options.replace(/:/g, "\\x3A").replace(/"/g, "\\\"");
            return `${indent}echo "NEXTERM_SELECT:${varName}:${escapedPrompt}:${escapedOptions}" && read -r ${varName}`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:WARN\s+"((?:\\.|[^"\\])*)"/gm,
        (match, indent, message) => {
            const escapedMessage = message.replace(/:/g, "\\x3A");
            return `${indent}echo "NEXTERM_WARN:${escapedMessage}"`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:INFO\s+"((?:\\.|[^"\\])*)"/gm,
        (match, indent, message) => {
            const escapedMessage = message.replace(/:/g, "\\x3A");
            return `${indent}echo "NEXTERM_INFO:${escapedMessage}"`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:CONFIRM\s+"((?:\\.|[^"\\])*)"/gm,
        (match, indent, message) => {
            const escapedMessage = message.replace(/:/g, "\\x3A");
            return `${indent}echo "NEXTERM_CONFIRM:${escapedMessage}" && read -r NEXTERM_CONFIRM_RESULT`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:PROGRESS\s+(\$?\w+|\d+)/gm,
        "$1echo \"NEXTERM_PROGRESS:$2\"",
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SUCCESS\s+"((?:\\.|[^"\\])*)"/gm,
        (match, indent, message) => {
            const escapedMessage = message.replace(/:/g, "\\x3A");
            return `${indent}echo "NEXTERM_SUCCESS:${escapedMessage}"`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SUMMARY\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm,
        (match, indent, title, data) => {
            const escapedTitle = title.replace(/:/g, "\\x3A").replace(/"/g, "\\\"");
            const escapedData = data.replace(/:/g, "\\x3A").replace(/"/g, "\\\"");
            return `${indent}echo "NEXTERM_SUMMARY:${escapedTitle}:${escapedData}" && read -r NEXTERM_SUMMARY_RESULT`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:TABLE\s+"((?:\\.|[^"\\])*)"\s+(.+)/gm,
        (match, indent, title, data) => {
            const escapedTitle = title.replace(/:/g, "\\x3A").replace(/"/g, "\\\"");
            const escapedData = data.replace(/:/g, "\\x3A").replace(/"/g, "\\\"");
            return `${indent}echo "NEXTERM_TABLE:${escapedTitle}:${escapedData}" && read -r NEXTERM_TABLE_RESULT`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:MSGBOX\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"/gm,
        (match, indent, title, message) => {
            const escapedTitle = title.replace(/:/g, "\\x3A");
            const escapedMessage = message.replace(/:/g, "\\x3A");
            return `${indent}echo "NEXTERM_MSGBOX:${escapedTitle}:${escapedMessage}" && read -r NEXTERM_MSGBOX_RESULT`;
        },
    );

    const scriptWithHeader = `#!/bin/bash
set -e
${transformedContent}
`;

    const base64Script = Buffer.from(scriptWithHeader).toString("base64");

    return `_script=$(mktemp) && echo '${base64Script}' | base64 -d > "$_script" && chmod +x "$_script" && "$_script"; _exit=$?; rm -f "$_script"; exit $_exit`;
};

module.exports.stripAnsi = (str) => {
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
};

module.exports.findNextermCommand = (line) => {
    const cleanLine = module.exports.stripAnsi(line);

    if (cleanLine.match(/echo\s+["']?NEXTERM_/i)) {
        return null;
    }

    const trimmedLine = cleanLine.trim();
    if (trimmedLine.match(/^[$#>]\s+.*NEXTERM_/)) {
        return null;
    }

    const match = cleanLine.match(/NEXTERM_(INPUT|SELECT|STEP|WARN|INFO|CONFIRM|PROGRESS|SUCCESS|SUMMARY|TABLE|MSGBOX):(.*)/s);
    if (match) {
        return {
            command: `NEXTERM_${match[1]}`,
            rest: match[2],
        };
    }
    return null;
};

module.exports.processNextermLine = (line) => {
    const found = module.exports.findNextermCommand(line);
    if (!found) return null;

    const { command, rest } = found;

    if (command === "NEXTERM_INPUT") {
        const parts = rest.split(":");
        const varName = parts[0];
        const prompt = module.exports.unescapeColons(parts[1] || "");
        const defaultValue = parts[2] ? module.exports.unescapeColons(parts[2]) : "";

        return { type: "input", variable: varName, prompt: prompt, default: defaultValue || "" };
    }

    if (command === "NEXTERM_SELECT") {
        const parts = rest.split(":");
        const varName = parts[0];
        const prompt = module.exports.unescapeColons(parts[1] || "");
        const optionsStr = parts.slice(2).join(":");
        const unescapedOptionsStr = module.exports.unescapeColons(optionsStr);
        const options = module.exports.parseOptions(unescapedOptionsStr);

        return { type: "select", variable: varName, prompt: prompt, options: options, default: options[0] || "" };
    }

    if (command === "NEXTERM_STEP") {
        const stepDesc = rest.trim();
        return { type: "step", description: stepDesc };
    }

    if (command === "NEXTERM_WARN") {
        const message = module.exports.unescapeColons(rest);
        return { type: "warning", message: message };
    }

    if (command === "NEXTERM_INFO") {
        const message = module.exports.unescapeColons(rest);
        return { type: "info", message: message };
    }

    if (command === "NEXTERM_CONFIRM") {
        const message = module.exports.unescapeColons(rest);
        return { type: "confirm", message: message };
    }

    if (command === "NEXTERM_PROGRESS") {
        const [percentage] = rest.split(":");
        return { type: "progress", percentage: parseInt(percentage) || 0 };
    }

    if (command === "NEXTERM_SUCCESS") {
        const message = module.exports.unescapeColons(rest);
        return { type: "success", message: message };
    }

    if (command === "NEXTERM_SUMMARY") {
        const parts = rest.split(":");
        const title = module.exports.unescapeColons(parts[0] || "");
        const dataStr = parts.slice(1).join(":");
        const unescapedDataStr = module.exports.unescapeColons(dataStr);
        const data = module.exports.parseOptions(unescapedDataStr);
        return { type: "summary", title: title, data: data };
    }

    if (command === "NEXTERM_TABLE") {
        const parts = rest.split(":");
        const title = module.exports.unescapeColons(parts[0] || "");
        const dataStr = parts.slice(1).join(":");
        const unescapedDataStr = module.exports.unescapeColons(dataStr);
        const data = module.exports.parseOptions(unescapedDataStr);
        return { type: "table", title: title, data: data };
    }

    if (command === "NEXTERM_MSGBOX") {
        const parts = rest.split(":");
        const title = module.exports.unescapeColons(parts[0] || "");
        const message = module.exports.unescapeColons(parts.slice(1).join(":"));
        return { type: "msgbox", title: title, message: message };
    }

    return null;
};