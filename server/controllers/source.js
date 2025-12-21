const Source = require("../models/Source");
const Snippet = require("../models/Snippet");
const Script = require("../models/Script");
const crypto = require("crypto");
const logger = require("../utils/logger");

module.exports.validateSourceUrl = async (url) => {
    try {
        const baseUrl = url.replace(/\/$/, "");
        const indexUrl = `${baseUrl}/NTINDEX`;

        const response = await fetch(indexUrl, {
            method: "GET",
            headers: {
                "User-Agent": "Nexterm/1.0",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            return { valid: false, error: `Failed to fetch NTINDEX: HTTP ${response.status}` };
        }

        const indexContent = await response.text();
        const parsedIndex = parseNTINDEX(indexContent);

        if (!parsedIndex.snippets.length && !parsedIndex.scripts.length) {
            return { valid: false, error: "NTINDEX is empty or invalid" };
        }

        return { valid: true, index: parsedIndex };
    } catch (error) {
        if (error.name === "TimeoutError") {
            return { valid: false, error: "Request timed out" };
        }
        return { valid: false, error: error.message };
    }
};

const parseNTINDEX = (content) => {
    const lines = content.split("\n").filter(line => line.trim() && !line.startsWith("#"));
    const snippets = [];
    const scripts = [];

    const scriptExtensions = [".sh", ".bash", ".zsh", ".fish", ".ps1"];
    const snippetExtensions = [".txt", ".snippet", ".cmd"];

    for (const line of lines) {
        const parts = line.split("@").map(p => p.trim());
        if (parts.length < 2) continue;

        const [path, hash] = parts;
        const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
        const entry = { hash, path };

        if (scriptExtensions.includes(ext)) {
            scripts.push(entry);
        } else if (snippetExtensions.includes(ext)) {
            snippets.push(entry);
        }
    }

    return { snippets, scripts };
};

const calculateContentHash = (content) => crypto.createHash("md5").update(content).digest("hex");


const reconstructSnippetFile = (snippet) => {
    let content = "";
    content += `# @name: ${snippet.name}\n`;
    if (snippet.description) {
        content += `# @description: ${snippet.description}\n`;
    }
    content += snippet.command;
    return content;
};

module.exports.createSource = async (sourceData) => {
    const { name, url } = sourceData;

    const normalizedUrl = url.replace(/\/$/, "");

    const existingSource = await Source.findOne({ where: { url: normalizedUrl } });
    if (existingSource) {
        return { code: 409, message: "A source with this URL already exists" };
    }

    const validation = await module.exports.validateSourceUrl(normalizedUrl);
    if (!validation.valid) {
        return { code: 400, message: `Invalid source URL: ${validation.error}` };
    }

    const source = await Source.create({ name, url: normalizedUrl, enabled: true });

    await module.exports.syncSource(source.id);

    return source;
};

module.exports.listSources = async () => {
    return await Source.findAll({ order: [["name", "ASC"]] });
};

module.exports.getSource = async (sourceId) => {
    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { code: 404, message: "Source not found" };
    }
    return source;
};

module.exports.updateSource = async (sourceId, updates) => {
    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { code: 404, message: "Source not found" };
    }

    const { name, url, enabled } = updates;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = enabled;

    if (url !== undefined && url !== source.url) {
        const normalizedUrl = url.replace(/\/$/, "");

        const existingSource = await Source.findOne({
            where: { url: normalizedUrl, id: { [require("sequelize").Op.ne]: sourceId } },
        });
        if (existingSource) {
            return { code: 409, message: "A source with this URL already exists" };
        }

        const validation = await module.exports.validateSourceUrl(normalizedUrl);
        if (!validation.valid) {
            return { code: 400, message: `Invalid source URL: ${validation.error}` };
        }

        updateData.url = normalizedUrl;
    }

    await Source.update(updateData, { where: { id: sourceId } });

    if (updateData.url) {
        await module.exports.syncSource(sourceId);
    }

    return await Source.findByPk(sourceId);
};

module.exports.deleteSource = async (sourceId) => {
    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { code: 404, message: "Source not found" };
    }

    if (source.isDefault) {
        return { code: 403, message: "Cannot delete the default source" };
    }

    await Snippet.destroy({ where: { sourceId } });
    await Script.destroy({ where: { sourceId } });

    await Source.destroy({ where: { id: sourceId } });
};

module.exports.syncSource = async (sourceId) => {
    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { success: false, error: "Source not found" };
    }

    if (!source.enabled) {
        return { success: false, error: "Source is disabled" };
    }

    try {
        logger.info(`Syncing source: ${source.name} (${source.url})`);

        const validation = await module.exports.validateSourceUrl(source.url);
        if (!validation.valid) {
            await Source.update({
                lastSyncStatus: "error",
            }, { where: { id: sourceId } });
            return { success: false, error: validation.error };
        }

        const { snippets: indexSnippets, scripts: indexScripts } = validation.index;

        const existingSnippets = await Snippet.findAll({ where: { sourceId } });
        const existingScripts = await Script.findAll({ where: { sourceId } });

        const existingSnippetMap = new Map(existingSnippets.map(s => [s.name, s]));
        const existingScriptMap = new Map(existingScripts.map(s => [s.name, s]));

        let snippetCount = 0;
        let scriptCount = 0;

        const processedSnippetNames = new Set();
        const processedScriptNames = new Set();

        for (const indexSnippet of indexSnippets) {
            let existingByHash = null;
            for (const [name, snippet] of existingSnippetMap) {
                const reconstructed = reconstructSnippetFile(snippet);
                const existingHash = calculateContentHash(reconstructed);
                if (existingHash === indexSnippet.hash) {
                    existingByHash = snippet;
                    processedSnippetNames.add(name);
                    break;
                }
            }

            if (existingByHash) {
                snippetCount++;
                continue;
            }

            const content = await fetchSourceFile(source.url, indexSnippet.path);
            if (!content) {
                logger.warn(`Failed to fetch snippet: ${indexSnippet.path}`);
                continue;
            }

            const fallbackName = indexSnippet.path.split("/").pop().replace(/\.[^.]+$/, "");
            const parsed = parseSnippetContent(content, fallbackName);
            const existing = existingSnippetMap.get(parsed.name);

            processedSnippetNames.add(parsed.name);

            if (existing) {
                await Snippet.update({
                    name: parsed.name,
                    command: parsed.command,
                    description: parsed.description,
                }, { where: { id: existing.id } });
            } else {
                await Snippet.create({
                    name: parsed.name,
                    command: parsed.command,
                    description: parsed.description,
                    accountId: null,
                    organizationId: null,
                    sourceId,
                });
            }
            snippetCount++;
        }

        for (const indexScript of indexScripts) {
            let existingByHash = null;
            for (const [name, script] of existingScriptMap) {
                const existingHash = calculateContentHash(script.content);
                if (existingHash === indexScript.hash) {
                    existingByHash = script;
                    processedScriptNames.add(name);
                    break;
                }
            }

            if (existingByHash) {
                scriptCount++;
                continue;
            }

            const content = await fetchSourceFile(source.url, indexScript.path);
            if (!content) {
                logger.warn(`Failed to fetch script: ${indexScript.path}`);
                continue;
            }

            const fallbackName = indexScript.path.split("/").pop().replace(/\.[^.]+$/, "");
            const parsed = parseScriptContent(content, fallbackName);
            const existing = existingScriptMap.get(parsed.name);

            processedScriptNames.add(parsed.name);

            if (existing) {
                await Script.update({
                    name: parsed.name,
                    content: parsed.content,
                    description: parsed.description,
                }, { where: { id: existing.id } });
            } else {
                await Script.create({
                    name: parsed.name,
                    content: parsed.content,
                    description: parsed.description,
                    accountId: null,
                    organizationId: null,
                    sourceId,
                });
            }
            scriptCount++;
        }

        for (const [name, snippet] of existingSnippetMap) {
            if (!processedSnippetNames.has(name)) {
                await Snippet.destroy({ where: { id: snippet.id } });
            }
        }
        for (const [name, script] of existingScriptMap) {
            if (!processedScriptNames.has(name)) {
                await Script.destroy({ where: { id: script.id } });
            }
        }

        await Source.update({
            lastSyncStatus: "success",
            snippetCount,
            scriptCount,
        }, { where: { id: sourceId } });

        logger.info(`Source sync completed: ${source.name} - ${snippetCount} snippets, ${scriptCount} scripts`);
        return { success: true };

    } catch (error) {
        logger.error(`Source sync failed: ${source.name}`, { error: error.message });
        await Source.update({
            lastSyncStatus: "error",
        }, { where: { id: sourceId } });
        return { success: false, error: error.message };
    }
};

module.exports.syncAllSources = async () => {
    const sources = await Source.findAll({ where: { enabled: true } });

    for (const source of sources) {
        await module.exports.syncSource(source.id);
    }
};

const fetchSourceFile = async (baseUrl, path) => {
    try {
        const url = `${baseUrl}/${path}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Nexterm/1.0",
            },
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            return null;
        }

        return await response.text();
    } catch (error) {
        return null;
    }
};

const parseSnippetContent = (content, defaultName) => {
    const lines = content.split("\n");
    let name = defaultName;
    let description = "";
    const commandLines = [];

    for (const line of lines) {
        const nameLine = line.match(/^#\s*@name:\s*(.+)$/i);
        if (nameLine) {
            name = nameLine[1].trim();
            continue;
        }

        const descLine = line.match(/^#\s*@description:\s*(.+)$/i);
        if (descLine) {
            description = descLine[1].trim();
            continue;
        }

        if (line.startsWith("#") && commandLines.length === 0) {
            continue;
        }

        commandLines.push(line);
    }

    return {
        name,
        command: commandLines.join("\n").trim(),
        description,
    };
};

const parseScriptContent = (content, defaultName) => {
    const lines = content.split("\n");
    let name = defaultName;
    let description = "";

    for (const line of lines) {
        const nameLine = line.match(/^#\s*@name:\s*(.+)$/i);
        if (nameLine) {
            name = nameLine[1].trim();
            continue;
        }

        const descLine = line.match(/^#\s*@description:\s*(.+)$/i);
        if (descLine) {
            description = descLine[1].trim();
            break;
        }
    }

    return { name, content: content, description };
};

module.exports.ensureDefaultSource = async () => {
    const DEFAULT_SOURCE_URL = "https://source.nexterm.dev";
    const DEFAULT_SOURCE_NAME = "Official";

    const existingDefault = await Source.findOne({ where: { isDefault: true } });
    if (existingDefault) {
        if (existingDefault.url !== DEFAULT_SOURCE_URL) {
            await Source.update({ url: DEFAULT_SOURCE_URL }, { where: { id: existingDefault.id } });
        }
        return;
    }

    const existingByUrl = await Source.findOne({ where: { url: DEFAULT_SOURCE_URL } });
    if (existingByUrl) {
        await Source.update({ isDefault: true }, { where: { id: existingByUrl.id } });
        return;
    }

    await Source.create({
        name: DEFAULT_SOURCE_NAME,
        url: DEFAULT_SOURCE_URL,
        enabled: true,
        isDefault: true,
    });

    logger.info("Created default official source");
};

module.exports.parseNTINDEX = parseNTINDEX;
