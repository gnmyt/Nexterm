const Source = require("../models/Source");
const Snippet = require("../models/Snippet");
const Script = require("../models/Script");
const Theme = require("../models/Theme");
const crypto = require("crypto");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

const DEFAULT_SOURCE = {
    name: "Official",
    url: "https://source.nexterm.dev",
};

const THIRD_PARTY_SOURCES = [
    {
        key: "nerdystore",
        name: "NerdyStore",
        url: "http://source.nerdytech.dev",
    },
];

const syncingSources = new Set();

const syncSourceInBackground = (sourceId) => {
    module.exports.syncSource(sourceId).catch(error => {
        logger.error("Background source sync failed", { sourceId, error: error.message });
    });
};

const runWithConcurrency = async (items, limit, handler) => {
    let index = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const item = items[index++];
            await handler(item);
        }
    });

    await Promise.all(workers);
};

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

        if (!parsedIndex.snippets.length && !parsedIndex.scripts.length && !parsedIndex.themes.length) {
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
    const themes = [];

    const scriptExtensions = [".sh", ".bash", ".zsh", ".fish", ".ps1"];
    const snippetExtensions = [".txt", ".snippet", ".cmd"];
    const themeExtension = ".theme.css";

    for (const line of lines) {
        const parts = line.split("@").map(p => p.trim());
        if (parts.length < 2) continue;

        const [path, hash] = parts;

        if (path.toLowerCase().endsWith(themeExtension)) {
            themes.push({ hash, path });
            continue;
        }

        const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
        const entry = { hash, path };

        if (scriptExtensions.includes(ext)) {
            scripts.push(entry);
        } else if (snippetExtensions.includes(ext)) {
            snippets.push(entry);
        }
    }

    return { snippets, scripts, themes };
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

    const source = await Source.create({
        name,
        url: normalizedUrl,
        enabled: true,
        lastSyncStatus: "syncing",
    });

    syncSourceInBackground(source.id);

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
            where: { url: normalizedUrl, id: { [Op.ne]: sourceId } },
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

    if (updateData.url || (source.enabled === false && updateData.enabled === true)) {
        await Source.update({ lastSyncStatus: "syncing" }, { where: { id: sourceId } });
        syncSourceInBackground(sourceId);
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
    await Theme.destroy({ where: { sourceId } });

    await Source.destroy({ where: { id: sourceId } });
};

module.exports.syncSource = async (sourceId) => {
    if (syncingSources.has(sourceId)) {
        return { success: true, inProgress: true };
    }

    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { success: false, error: "Source not found" };
    }

    if (!source.enabled) {
        return { success: false, error: "Source is disabled" };
    }

    syncingSources.add(sourceId);

    try {
        logger.info(`Syncing source: ${source.name} (${source.url})`);
        await Source.update({
            lastSyncStatus: "syncing",
        }, { where: { id: sourceId } });

        const validation = await module.exports.validateSourceUrl(source.url);
        if (!validation.valid) {
            await Source.update({
                lastSyncStatus: "error",
            }, { where: { id: sourceId } });
            return { success: false, error: validation.error };
        }

        const { snippets: indexSnippets, scripts: indexScripts, themes: indexThemes } = validation.index;

        const existingSnippets = await Snippet.findAll({ where: { sourceId } });
        const existingScripts = await Script.findAll({ where: { sourceId } });
        const existingThemes = await Theme.findAll({ where: { sourceId } });

        const existingSnippetMap = new Map(existingSnippets.map(s => [s.name, s]));
        const existingScriptMap = new Map(existingScripts.map(s => [s.name, s]));
        const existingThemeMap = new Map(existingThemes.map(t => [t.name, t]));

        let snippetCount = 0;
        let scriptCount = 0;
        let themeCount = 0;

        const processedSnippetNames = new Set();
        const processedScriptNames = new Set();
        const processedThemeNames = new Set();

        await runWithConcurrency(indexSnippets, 12, async (indexSnippet) => {
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
                return;
            }

            const content = await fetchSourceFile(source.url, indexSnippet.path);
            if (!content) {
                logger.warn(`Failed to fetch snippet: ${indexSnippet.path}`);
                return;
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
                    osFilter: parsed.osFilter,
                }, { where: { id: existing.id } });
            } else {
                await Snippet.create({
                    name: parsed.name,
                    command: parsed.command,
                    description: parsed.description,
                    osFilter: parsed.osFilter,
                    accountId: null,
                    organizationId: null,
                    sourceId,
                });
            }
            snippetCount++;
        });

        await runWithConcurrency(indexScripts, 12, async (indexScript) => {
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
                return;
            }

            const content = await fetchSourceFile(source.url, indexScript.path);
            if (!content) {
                logger.warn(`Failed to fetch script: ${indexScript.path}`);
                return;
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
                    osFilter: parsed.osFilter,
                }, { where: { id: existing.id } });
            } else {
                await Script.create({
                    name: parsed.name,
                    content: parsed.content,
                    description: parsed.description,
                    osFilter: parsed.osFilter,
                    accountId: null,
                    organizationId: null,
                    sourceId,
                });
            }
            scriptCount++;
        });

        await runWithConcurrency(indexThemes, 12, async (indexTheme) => {
            let existingByHash = null;
            for (const [name, theme] of existingThemeMap) {
                const existingHash = calculateContentHash(theme.css);
                if (existingHash === indexTheme.hash) {
                    existingByHash = theme;
                    processedThemeNames.add(name);
                    break;
                }
            }

            if (existingByHash) {
                themeCount++;
                return;
            }

            const content = await fetchSourceFile(source.url, indexTheme.path);
            if (!content) {
                logger.warn(`Failed to fetch theme: ${indexTheme.path}`);
                return;
            }

            const parsed = parseThemeContent(content, indexTheme.path);
            const existing = existingThemeMap.get(parsed.name);

            processedThemeNames.add(parsed.name);

            if (existing) {
                await Theme.update({
                    name: parsed.name,
                    css: parsed.css,
                    description: parsed.description,
                }, { where: { id: existing.id } });
            } else {
                await Theme.create({
                    name: parsed.name,
                    css: parsed.css,
                    description: parsed.description,
                    accountId: null,
                    sourceId,
                });
            }
            themeCount++;
        });

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
        for (const [name, theme] of existingThemeMap) {
            if (!processedThemeNames.has(name)) {
                await Theme.destroy({ where: { id: theme.id } });
            }
        }

        await Source.update({
            lastSyncStatus: "success",
            snippetCount,
            scriptCount,
            themeCount,
        }, { where: { id: sourceId } });

        logger.info(`Source sync completed: ${source.name} - ${snippetCount} snippets, ${scriptCount} scripts, ${themeCount} themes`);
        return { success: true };

    } catch (error) {
        logger.error(`Source sync failed: ${source.name}`, { error: error.message });
        await Source.update({
            lastSyncStatus: "error",
        }, { where: { id: sourceId } });
        return { success: false, error: error.message };
    } finally {
        syncingSources.delete(sourceId);
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
    let osFilter = [];
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

        const osLine = line.match(/^#\s*@os:\s*(.+)$/i);
        if (osLine) {
            osFilter = osLine[1].split(',').map(s => s.trim()).filter(Boolean);
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
        osFilter: osFilter.length > 0 ? osFilter : null,
    };
};

const parseScriptContent = (content, defaultName) => {
    const lines = content.split("\n");
    let name = defaultName;
    let description = "";
    let osFilter = [];

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

        const osLine = line.match(/^#\s*@os:\s*(.+)$/i);
        if (osLine) {
            osFilter = osLine[1].split(',').map(s => s.trim()).filter(Boolean);
            continue;
        }

        if (!line.startsWith("#")) break;
    }

    return { name, content, description, osFilter: osFilter.length > 0 ? osFilter : null };
};

const parseThemeContent = (content, path) => {
    const lines = content.split("\n");
    let name = path.split("/").pop().replace(/\.theme\.css$/i, "");
    let description = "";

    for (const line of lines) {
        const nameLine = line.match(/^\/\*\s*@name:\s*(.+?)\s*\*\/$/i) || line.match(/^\s*\/\*\*?\s*@name:\s*(.+?)\s*\*?\*?\/?\s*$/i);
        if (nameLine) {
            name = nameLine[1].trim();
            continue;
        }

        const descLine = line.match(/^\/\*\s*@description:\s*(.+?)\s*\*\/$/i) || line.match(/^\s*\/\*\*?\s*@description:\s*(.+?)\s*\*?\*?\/?\s*$/i);
        if (descLine) {
            description = descLine[1].trim();
            continue;
        }

        if (!line.trim().startsWith("/*") && !line.trim().startsWith("*") && line.trim()) break;
    }

    return { name, css: content, description };
};

module.exports.ensureDefaultSource = async () => {
    const existingDefault = await Source.findOne({ where: { isDefault: true } });
    if (existingDefault) {
        if (existingDefault.url !== DEFAULT_SOURCE.url) {
            await Source.update({ url: DEFAULT_SOURCE.url }, { where: { id: existingDefault.id } });
        }
        return;
    }

    const existingByUrl = await Source.findOne({ where: { url: DEFAULT_SOURCE.url } });
    if (existingByUrl) {
        await Source.update({ isDefault: true }, { where: { id: existingByUrl.id } });
        return;
    }

    await Source.create({
        name: DEFAULT_SOURCE.name,
        url: DEFAULT_SOURCE.url,
        enabled: true,
        isDefault: true,
    });

    logger.info("Created default official source");
};

module.exports.ensureThirdPartySources = async () => {
    logger.warn("ensureThirdPartySources is deprecated; third-party sources are now added explicitly by users");
};

module.exports.ensureConfiguredSources = async () => {
    await module.exports.ensureDefaultSource();
};

module.exports.listThirdPartySources = async () => {
    const urls = THIRD_PARTY_SOURCES.map(source => source.url.replace(/\/$/, ""));
    const existingSources = await Source.findAll({ where: { url: { [Op.in]: urls } } });
    const existingByUrl = new Map(existingSources.map(source => [source.url, source]));

    return THIRD_PARTY_SOURCES.map(source => {
        const normalizedUrl = source.url.replace(/\/$/, "");
        const existingSource = existingByUrl.get(normalizedUrl);

        return {
            key: source.key,
            name: source.name,
            url: normalizedUrl,
            added: !!existingSource,
            enabled: existingSource?.enabled ?? false,
            sourceId: existingSource?.id ?? null,
        };
    });
};

module.exports.addThirdPartySource = async (sourceKey) => {
    const thirdPartySource = THIRD_PARTY_SOURCES.find(source => source.key === sourceKey);
    if (!thirdPartySource) {
        return { code: 404, message: "Third-party source not found" };
    }

    const normalizedUrl = thirdPartySource.url.replace(/\/$/, "");
    let source = await Source.findOne({ where: { url: normalizedUrl } });

    if (source) {
        if (!source.enabled) {
            await Source.update({
                enabled: true,
                name: source.name || thirdPartySource.name,
                lastSyncStatus: "syncing",
            }, { where: { id: source.id } });
            source = await Source.findByPk(source.id);
        }
    } else {
        source = await Source.create({
            name: thirdPartySource.name,
            url: normalizedUrl,
            enabled: true,
            isDefault: false,
            lastSyncStatus: "syncing",
        });
    }

    syncSourceInBackground(source.id);

    return await Source.findByPk(source.id);
};

module.exports.parseNTINDEX = parseNTINDEX;
