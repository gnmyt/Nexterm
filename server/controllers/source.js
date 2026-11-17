const Source = require("../models/Source");
const Snippet = require("../models/Snippet");
const Script = require("../models/Script");
const Theme = require("../models/Theme");
const crypto = require("crypto");
const logger = require("../utils/logger");
const { assertPublicUrl } = require("../utils/ssrf");

module.exports.validateSourceUrl = async (url) => {
    try {
        const baseUrl = url.replace(/\/$/, "");
        const indexUrl = `${baseUrl}/NTINDEX`;

        await assertPublicUrl(indexUrl);

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

    const source = await Source.create({ name, url: normalizedUrl, enabled: true });

    syncInBackground(source.id);

    return withSyncState(source);
};

module.exports.listSources = async () => {
    const sources = await Source.findAll({ order: [["name", "ASC"]] });
    return sources.map(withSyncState);
};

module.exports.getSource = async (sourceId) => {
    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { code: 404, message: "Source not found" };
    }
    return withSyncState(source);
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
        syncInBackground(sourceId);
    }

    return withSyncState(await Source.findByPk(sourceId));
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

const FETCH_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 1;

const activeSyncs = new Map();

const stripExtension = (path) => path.split("/").pop().replace(/\.[^.]+$/, "");
const stripThemeExtension = (path) => path.split("/").pop().replace(/\.theme\.css$/i, "");

const SYNC_TYPES = [
    {
        key: "snippets",
        model: Snippet,
        countField: "snippetCount",
        hashOf: (item) => calculateContentHash(reconstructSnippetFile(item)),
        fallbackName: stripExtension,
        parse: (content, path) => parseSnippetContent(content, stripExtension(path)),
        toFields: (p) => ({ name: p.name, command: p.command, description: p.description, osFilter: p.osFilter }),
        createDefaults: { accountId: null, organizationId: null },
    },
    {
        key: "scripts",
        model: Script,
        countField: "scriptCount",
        hashOf: (item) => calculateContentHash(item.content),
        fallbackName: stripExtension,
        parse: (content, path) => parseScriptContent(content, stripExtension(path)),
        toFields: (p) => ({ name: p.name, content: p.content, description: p.description, osFilter: p.osFilter }),
        createDefaults: { accountId: null, organizationId: null },
    },
    {
        key: "themes",
        model: Theme,
        countField: "themeCount",
        hashOf: (item) => calculateContentHash(item.css),
        fallbackName: stripThemeExtension,
        parse: (content, path) => parseThemeContent(content, path),
        toFields: (p) => ({ name: p.name, css: p.css, description: p.description }),
        createDefaults: { accountId: null },
    },
];

const mapWithConcurrency = async (items, limit, fn) => {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

const buildFileUrl = (baseUrl, path) => {
    const base = new URL(`${baseUrl}/`);
    const url = new URL(`${baseUrl}/${path}`);

    if (url.origin !== base.origin) throw new Error(`File outside source origin: ${path}`);
    return url.href;
};

const fetchSourceFile = async (baseUrl, path) => {
    let url;
    try {
        url = buildFileUrl(baseUrl, path);
    } catch {
        return null;
    }

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: { "User-Agent": "Nexterm/1.0" },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (response.ok) return await response.text();

            if (response.status < 500 && response.status !== 429) return null;
        } catch {
        }
    }
    return null;
};

const groupBy = (items, keyOf) => {
    const map = new Map();
    for (const item of items) {
        const key = keyOf(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    }
    return map;
};

const syncType = async (type, source, indexEntries) => {
    const sourceId = source.id;
    const existing = await type.model.findAll({ where: { sourceId } });

    const existingByHash = groupBy(existing, type.hashOf);
    const existingByName = groupBy(existing, item => item.name);
    const claimed = new Set();
    const claim = (candidates) => {
        const row = candidates?.find(item => !claimed.has(item.id));
        if (row) claimed.add(row.id);
        return row;
    };

    const toFetch = indexEntries.filter(entry => !claim(existingByHash.get(entry.hash)));

    const contents = await mapWithConcurrency(toFetch, FETCH_CONCURRENCY,
        entry => fetchSourceFile(source.url, entry.path));

    let failed = 0;
    const parsed = [];
    toFetch.forEach((entry, i) => {
        if (contents[i] == null) {
            failed++;
            logger.warn(`Failed to fetch ${type.key.slice(0, -1)}: ${entry.path}`);

            claim(existingByName.get(type.fallbackName(entry.path)));
            return;
        }
        parsed.push(type.toFields(type.parse(contents[i], entry.path)));
    });

    const updates = [];
    const creates = [];
    for (const fields of parsed) {
        const row = claim(existingByName.get(fields.name));
        if (row) updates.push([row.id, fields]);
        else creates.push({ ...fields, ...type.createDefaults, sourceId });
    }

    for (const [id, fields] of updates) {
        await type.model.update(fields, { where: { id } });
    }
    if (creates.length) {
        await type.model.bulkCreate(creates);
    }

    return {
        count: claimed.size + creates.length,
        failed,
        fetched: toFetch.length,
        staleIds: existing.filter(item => !claimed.has(item.id)).map(item => item.id),
    };
};

const runSync = async (sourceId) => {
    const source = await Source.findByPk(sourceId);
    if (!source) {
        return { success: false, error: "Source not found" };
    }

    if (!source.enabled) {
        return { success: false, error: "Source is disabled" };
    }

    const startedAt = Date.now();

    try {
        logger.info(`Syncing source: ${source.name} (${source.url})`);

        const validation = await module.exports.validateSourceUrl(source.url);
        if (!validation.valid) {
            await Source.update({ lastSyncStatus: "error" }, { where: { id: sourceId } });
            return { success: false, error: validation.error };
        }

        const results = [];
        for (const type of SYNC_TYPES) {
            results.push(await syncType(type, source, validation.index[type.key]));
        }

        const incompleteFetches = results.reduce((sum, r) => sum + r.failed, 0);

        if (incompleteFetches > 0) {
            logger.warn(`Skipping source cleanup for ${source.name}: ${incompleteFetches} file fetch failure(s); preserving existing content`);
        } else {
            for (let i = 0; i < SYNC_TYPES.length; i++) {
                if (results[i].staleIds.length) {
                    await SYNC_TYPES[i].model.destroy({ where: { id: results[i].staleIds } });
                }
            }
        }

        const counts = {};
        SYNC_TYPES.forEach((type, i) => { counts[type.countField] = results[i].count; });

        await Source.update({
            lastSyncStatus: incompleteFetches > 0 ? "error" : "success",
            ...counts,
        }, { where: { id: sourceId } });

        if (incompleteFetches > 0) {
            const error = `Sync incomplete: ${incompleteFetches} file(s) failed to download; existing content preserved`;
            logger.warn(`Source sync incomplete: ${source.name} - ${error}`);
            return { success: false, error };
        }

        const fetched = results.reduce((sum, r) => sum + r.fetched, 0);
        logger.info(`Source sync completed: ${source.name} - ${counts.snippetCount} snippets, ${counts.scriptCount} scripts, ${counts.themeCount} themes (${fetched} file(s) downloaded in ${Date.now() - startedAt}ms)`);
        return { success: true };

    } catch (error) {
        logger.error(`Source sync failed: ${source.name}`, { error: error.message });
        await Source.update({ lastSyncStatus: "error" }, { where: { id: sourceId } });
        return { success: false, error: error.message };
    }
};

module.exports.syncSource = (sourceId) => {
    if (activeSyncs.has(sourceId)) return activeSyncs.get(sourceId);
    const promise = runSync(sourceId).finally(() => activeSyncs.delete(sourceId));
    activeSyncs.set(sourceId, promise);
    return promise;
};

module.exports.isSyncing = (sourceId) => activeSyncs.has(sourceId);

const withSyncState = (source) => {
    const data = typeof source?.toJSON === "function" ? source.toJSON() : source;
    return { ...data, syncing: activeSyncs.has(data.id) };
};

const syncInBackground = (sourceId) => {
    module.exports.syncSource(sourceId).catch(error => {
        logger.error(`Background source sync failed for source ${sourceId}`, { error: error.message });
    });
};

module.exports.syncAllSources = async () => {
    const sources = await Source.findAll({ where: { enabled: true } });

    for (const source of sources) {
        await module.exports.syncSource(source.id);
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
