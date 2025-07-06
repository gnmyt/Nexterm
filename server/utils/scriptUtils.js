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
        /^(\s*)@NEXTERM:STEP\s+"([^"]+)"/gm,
        "$1echo \"NEXTERM_STEP:$2\"");

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:INPUT\s+(\S+)\s+"([^"]+)"(?:\s+"([^"]*)")?/gm,
        "$1echo \"NEXTERM_INPUT:$2:$3:$4\" && read -r $2");

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SELECT\s+"([^"]+)"\s+"([^"]+)"\s+(.+)/gm,
        (match, indent, varName, prompt, options) => {
            const escapedOptions = options.replace(/"/g, "\\\"");
            return `${indent}echo "NEXTERM_SELECT:${varName}:${prompt}:${escapedOptions}" && read -r ${varName}`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SELECT\s+(\S+)\s+"([^"]+)"\s+(.+)/gm,
        (match, indent, varName, prompt, options) => {
            const escapedOptions = options.replace(/"/g, "\\\"");
            return `${indent}echo "NEXTERM_SELECT:${varName}:${prompt}:${escapedOptions}" && read -r ${varName}`;
        },
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:WARN\s+"([^"]+)"/gm,
        "$1echo \"NEXTERM_WARN:$2\"",
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:INFO\s+"([^"]+)"/gm,
        "$1echo \"NEXTERM_INFO:$2\"",
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:CONFIRM\s+"([^"]+)"(?:\s+"([^"]*)")?/gm,
        "$1echo \"NEXTERM_CONFIRM:$2:$3\" && read -r NEXTERM_CONFIRM_RESULT",
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:PROGRESS\s+(\$?\w+|\d+|"[^"]*")\s+"([^"]+)"/gm,
        "$1echo \"NEXTERM_PROGRESS:$2:$3\"",
    );

    transformedContent = transformedContent.replace(
        /^(\s*)@NEXTERM:SUCCESS\s+"([^"]+)"/gm,
        "$1echo \"NEXTERM_SUCCESS:$2\"",
    );

    return `#!/bin/bash
set -e
${transformedContent}
exit 0
`;
};

module.exports.processNextermLine = (line) => {
    if (line.startsWith("NEXTERM_INPUT:")) {
        const parts = line.substring(14).split(":");
        const [varName, prompt, defaultValue] = parts;

        return { type: "input", variable: varName, prompt: prompt, default: defaultValue || "" };
    }

    if (line.startsWith("NEXTERM_SELECT:")) {
        const parts = line.substring(15).split(":");
        const varName = parts[0];
        const prompt = parts[1];
        const optionsStr = parts.slice(2).join(":");
        const options = module.exports.parseOptions(optionsStr);

        return { type: "select", variable: varName, prompt: prompt, options: options, default: options[0] || "" };
    }

    if (line.startsWith("NEXTERM_STEP:")) {
        const stepDesc = line.substring(13);
        return { type: "step", description: stepDesc };
    }

    if (line.startsWith("NEXTERM_WARN:")) {
        const message = line.substring(13);
        return { type: "warning", message: message };
    }

    if (line.startsWith("NEXTERM_INFO:")) {
        const message = line.substring(13);
        return { type: "info", message: message };
    }

    if (line.startsWith("NEXTERM_CONFIRM:")) {
        const parts = line.substring(16).split(":");
        const [message, defaultAction] = parts;
        return { type: "confirm", message: message, default: defaultAction || "No" };
    }

    if (line.startsWith("NEXTERM_PROGRESS:")) {
        const parts = line.substring(17).split(":");
        const [percentage, message] = parts;
        return { type: "progress", percentage: parseInt(percentage) || 0, message: message || "" };
    }

    if (line.startsWith("NEXTERM_SUCCESS:")) {
        const message = line.substring(16);
        return { type: "success", message: message };
    }

    return null;
};