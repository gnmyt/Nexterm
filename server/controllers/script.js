const fs = require("fs");
const path = require("path");

let scripts = [];

const parseScriptFile = (filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    const metadata = { name: "Unknown Script", description: "No description provided" };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("#")) break;

        const metaMatch = trimmed.match(/^#\s*@(\w+):\s*(.+)$/);
        if (metaMatch) {
            const [, key, value] = metaMatch;
            if (key in metadata) {
                metadata[key] = value.trim();
            }
        }
    }

    return { ...metadata, content, type: "script" };
};

const parseCustomScripts = (accountId) => {
    const customDir = path.join(process.cwd(), "data/sources/custom", accountId.toString());
    if (!fs.existsSync(customDir)) {
        return [];
    }

    const files = fs.readdirSync(customDir);
    const customScripts = [];

    for (const file of files) {
        if (file.endsWith(".nexterm.sh")) {
            try {
                const scriptData = parseScriptFile(path.join(customDir, file));
                customScripts.push({
                    ...scriptData,
                    id: `custom/${accountId}/${file.replace(".nexterm.sh", "")}`,
                    source: "custom",
                });
            } catch (err) {
                console.error(`Error parsing custom script ${file}:`, err.message);
            }
        }
    }

    return customScripts;
};

const parseScriptsFromSources = () => {
    const sourceScripts = [];
    const sourcesDir = path.join(process.cwd(), "data/sources");

    if (!fs.existsSync(sourcesDir)) return sourceScripts;

    const sources = fs.readdirSync(sourcesDir);

    for (const source of sources) {
        if (source === "custom") continue;

        const sourceDir = path.join(sourcesDir, source);
        if (!fs.statSync(sourceDir).isDirectory()) continue;

        const files = fs.readdirSync(sourceDir);

        for (const file of files) {
            if (file.endsWith(".nexterm.sh")) {
                try {
                    const scriptData = parseScriptFile(path.join(sourceDir, file));
                    sourceScripts.push({ ...scriptData, id: `${source}/${file.replace(".nexterm.sh", "")}`, source });
                } catch (err) {
                    console.error(`Error parsing script ${file} from source ${source}:`, err.message);
                }
            }
        }
    }

    return sourceScripts;
};

module.exports.refreshScripts = (accountId = null) => {
    const sourceScripts = parseScriptsFromSources();

    if (accountId) {
        const customScripts = parseCustomScripts(accountId);
        scripts = [...sourceScripts, ...customScripts];
    } else {
        scripts = sourceScripts;
    }

    console.log(`Refreshed ${scripts.length} scripts`);
};

module.exports.getScripts = (accountId = null) => {
    if (accountId) {
        const sourceScripts = scripts.filter(s => s.source !== "custom");
        const customScripts = parseCustomScripts(accountId);
        return [...sourceScripts, ...customScripts];
    }
    return scripts.filter(s => s.source !== "custom");
};

module.exports.getScript = (id, accountId = null) => {
    if (id.startsWith("custom/") && accountId) return parseCustomScripts(accountId).find(script => script.id === id);
    return scripts.find(script => script.id === id);
};

module.exports.searchScripts = (search, accountId = null) => {
    const allScripts = module.exports.getScripts(accountId);
    return allScripts.filter(script => script.name.toLowerCase().includes(search.toLowerCase())
        || script.description.toLowerCase().includes(search.toLowerCase()));
};

module.exports.createCustomScript = (accountId, scriptData) => {
    const customDir = path.join(process.cwd(), "data/sources/custom", accountId.toString());

    if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir, { recursive: true });
    }

    const fileName = `${scriptData.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.nexterm.sh`;
    const filePath = path.join(customDir, fileName);

    if (fs.existsSync(filePath)) throw new Error("A script with this name already exists");

    const scriptContent = `#!/bin/bash
# @name: ${scriptData.name}
# @description: ${scriptData.description}

${scriptData.content}
`;

    fs.writeFileSync(filePath, scriptContent);

    return {
        id: `custom/${accountId}/${fileName.replace(".nexterm.sh", "")}`, ...scriptData,
        type: "script",
        source: "custom",
    };
};

module.exports.updateCustomScript = (accountId, scriptId, scriptData) => {
    const scriptIdParts = scriptId.split("/");
    if (scriptIdParts[0] !== "custom" || scriptIdParts[1] !== accountId.toString()) {
        throw new Error("Unauthorized to edit this script");
    }

    const fileName = `${scriptIdParts[2]}.nexterm.sh`;
    const filePath = path.join(process.cwd(), "data/sources/custom", accountId.toString(), fileName);

    if (!fs.existsSync(filePath)) {
        throw new Error("Script not found");
    }

    const scriptContent = `#!/bin/bash
# @name: ${scriptData.name}
# @description: ${scriptData.description}

${scriptData.content}
`;

    fs.writeFileSync(filePath, scriptContent);

    return { id: scriptId, ...scriptData, type: "script", source: "custom" };
};

module.exports.deleteCustomScript = (accountId, scriptId) => {
    const scriptIdParts = scriptId.split("/");
    if (scriptIdParts[0] !== "custom" || scriptIdParts[1] !== accountId.toString()) {
        throw new Error("Unauthorized to delete this script");
    }

    const fileName = `${scriptIdParts[2]}.nexterm.sh`;
    const filePath = path.join(process.cwd(), "data/sources/custom", accountId.toString(), fileName);

    if (!fs.existsSync(filePath)) throw new Error("Script not found");

    fs.unlinkSync(filePath);
};
