const Folder = require("../models/Folder");
const EntryIdentity = require("../models/EntryIdentity");
const FolderIdentityProfile = require("../models/FolderIdentityProfile");
const Identity = require("../models/Identity");
const { Op } = require("sequelize");

const INHERITANCE_KEY = "__nextermInheritance";
const DETAIL_FIELDS = new Set(["engineId", "ip", "port", "macAddress", "wolBroadcastAddress"]);
const CONFIG_SECTIONS = ["details", "settings"];
const ALL_SECTIONS = [...CONFIG_SECTIONS, "identities"];
const SUPPORTED_PROTOCOLS = ["ssh", "telnet", "rdp", "vnc", "sftp", "ftp", "ftps"];

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const getInheritanceShapeError = (inheritance, { allowEmbeddedIdentities = false } = {}) => {
    if (inheritance === undefined || inheritance === null) return null;
    if (!isPlainObject(inheritance)) return "Folder inheritance settings must be an object";

    if (inheritance.config !== undefined) {
        if (!isPlainObject(inheritance.config)) return "Legacy folder inheritance config must be an object";
        if (inheritance.config.protocol !== undefined && !SUPPORTED_PROTOCOLS.includes(inheritance.config.protocol)) {
            return "Folder inheritance contains an unsupported protocol";
        }
    }

    if (!allowEmbeddedIdentities
        && (Object.hasOwn(inheritance, "identityProfiles") || Object.hasOwn(inheritance, "identities"))) {
        return "Folder identity profiles must be saved separately from inheritance settings";
    }

    for (const key of ["profiles", "identityProfiles", "sectionEnabled"]) {
        if (inheritance[key] !== undefined && !isPlainObject(inheritance[key])) {
            return `Folder inheritance ${key} must be an object`;
        }
    }
    for (const [protocol, profile] of Object.entries(inheritance.profiles || {})) {
        if (!SUPPORTED_PROTOCOLS.includes(protocol)) return "Folder inheritance contains an unsupported protocol";
        if (!isPlainObject(profile)) return "Folder inheritance profiles must be objects";
    }
    for (const [protocol, identityIds] of Object.entries(inheritance.identityProfiles || {})) {
        if (!SUPPORTED_PROTOCOLS.includes(protocol)) return "Folder inheritance contains an unsupported protocol";
        if (!Array.isArray(identityIds) || identityIds.some((identityId) => !Number.isInteger(identityId))) {
            return "Folder inheritance identity profiles must contain numeric identity IDs";
        }
    }
    if (inheritance.identities !== undefined
        && (!Array.isArray(inheritance.identities) || inheritance.identities.some((identityId) => !Number.isInteger(identityId)))) {
        return "Folder inheritance identities must contain numeric identity IDs";
    }
    for (const [protocol, sections] of Object.entries(inheritance.sectionEnabled || {})) {
        if (!SUPPORTED_PROTOCOLS.includes(protocol)) return "Folder inheritance contains an unsupported protocol";
        if (!isPlainObject(sections)) return "Folder inheritance section states must be objects";
        for (const [section, enabled] of Object.entries(sections)) {
            if (!ALL_SECTIONS.includes(section) || typeof enabled !== "boolean") {
                return "Folder inheritance contains an invalid section state";
            }
        }
    }
    return null;
};

const getTemporaryIdentityReferenceError = (identityProfiles, identityCreates = []) => {
    const createdIds = new Set(identityCreates.map(({ temporaryId }) => temporaryId));
    const referencedIds = new Set(Object.values(identityProfiles || {})
        .flat()
        .filter((identityId) => typeof identityId === "string"));

    for (const temporaryId of referencedIds) {
        if (!createdIds.has(temporaryId)) return "Identity profiles contain an unknown temporary identity";
    }
    for (const temporaryId of createdIds) {
        if (!referencedIds.has(temporaryId)) return "New identities must be linked to an identity profile";
    }
    return null;
};

const withoutInheritance = (config) => {
    const settings = { ...config };
    delete settings[INHERITANCE_KEY];
    return settings;
};

const changesProtocol = (currentConfig, nextConfig) => nextConfig?.protocol !== undefined
    && nextConfig.protocol !== withoutInheritance(currentConfig).protocol;
const omitsProtocol = (nextConfig) => nextConfig !== undefined && nextConfig.protocol === undefined;

const getConfigSection = (key) => DETAIL_FIELDS.has(key) ? "details" : "settings";

const pickSectionConfig = (config, section) => Object.fromEntries(
    Object.entries(config || {}).filter(([key]) => key !== "protocol" && getConfigSection(key) === section)
);

const replaceSectionConfig = (config, section, values) => {
    const next = { ...config };
    for (const key of Object.keys(next)) {
        if (key !== "protocol" && getConfigSection(key) === section) delete next[key];
    }
    return { ...next, ...values };
};

const getLocalProfiles = (inheritance) => {
    const profiles = Object.fromEntries(Object.entries(inheritance?.profiles || {}).map(
        ([protocol, profile]) => [protocol, { ...profile }]
    ));
    if (!inheritance?.config || typeof inheritance.config !== "object" || Array.isArray(inheritance.config)) return profiles;

    const { protocol, ...legacyProfile } = inheritance.config;
    const protocols = protocol ? [protocol] : SUPPORTED_PROTOCOLS;
    for (const profileProtocol of protocols) {
        profiles[profileProtocol] = { ...legacyProfile, ...profiles[profileProtocol] };
    }
    return profiles;
};

const getProfileConfig = (inheritance, protocol) => getLocalProfiles(inheritance)[protocol] || {};

const getLocalSectionState = (inheritance, protocol, section) => {
    if (!inheritance) return "transparent";
    const savedSections = inheritance.sectionEnabled?.[protocol];
    if (savedSections && Object.hasOwn(savedSections, section)) {
        return savedSections[section] ? "enabled" : "disabled";
    }

    if (section === "identities") {
        if (Object.hasOwn(inheritance.identityProfiles || {}, protocol)) return "enabled";
        if (Object.hasOwn(inheritance, "identities")
            && (!inheritance.config?.protocol || inheritance.config.protocol === protocol)) return "enabled";
        return "transparent";
    }

    const profile = getProfileConfig(inheritance, protocol);
    return Object.keys(pickSectionConfig(profile, section)).length ? "enabled" : "transparent";
};

const FOLDER_MAP_CACHE_KEY = "__folders";

const loadFolderMap = async ({ transaction, cache } = {}) => {
    const load = async () => new Map((await Folder.findAll({ transaction })).map((folder) => [folder.id, folder]));
    if (!cache) return load();
    if (!cache.has(FOLDER_MAP_CACHE_KEY)) cache.set(FOLDER_MAP_CACHE_KEY, load());
    return cache.get(FOLDER_MAP_CACHE_KEY);
};

const getFolderLineage = async (folderId, options = {}) => {
    if (!folderId) return [];
    const folders = await loadFolderMap(options);
    const lineage = [];
    const visited = new Set();
    let folder = folders.get(Number(folderId));

    while (folder && !visited.has(folder.id)) {
        visited.add(folder.id);
        lineage.unshift(folder);
        folder = folder.parentId ? folders.get(folder.parentId) : null;
    }

    return lineage;
};

const getKnownProtocols = (lineage, requestedProtocol, identityRows = []) => {
    if (requestedProtocol) return [requestedProtocol];
    const protocols = new Set();
    identityRows.forEach((row) => protocols.add(row.protocol));
    for (const folder of lineage) {
        const inheritance = folder.config?.[INHERITANCE_KEY];
        if (!inheritance) continue;
        Object.keys(inheritance.profiles || {}).forEach((protocol) => protocols.add(protocol));
        Object.keys(inheritance.identityProfiles || {}).forEach((protocol) => protocols.add(protocol));
        Object.keys(inheritance.sectionEnabled || {}).forEach((protocol) => protocols.add(protocol));
        if (inheritance.config?.protocol) protocols.add(inheritance.config.protocol);
        else if (inheritance.config || Object.hasOwn(inheritance, "identities")) {
            SUPPORTED_PROTOCOLS.forEach((protocol) => protocols.add(protocol));
        }
    }
    return [...protocols];
};

const resolveProtocol = (lineage, protocol, identityRowsByFolder = new Map()) => {
    const sectionConfig = { details: {}, settings: {} };
    let identities = [];
    const sectionSources = {
        details: { state: "transparent", folderId: null },
        settings: { state: "transparent", folderId: null },
        identities: { state: "transparent", folderId: null },
    };

    for (const folder of lineage) {
        const inheritance = folder.config?.[INHERITANCE_KEY];
        if (!inheritance) continue;
        const profile = getProfileConfig(inheritance, protocol);

        for (const section of CONFIG_SECTIONS) {
            const state = getLocalSectionState(inheritance, protocol, section);
            if (state === "transparent") continue;
            sectionConfig[section] = state === "enabled"
                ? { ...sectionConfig[section], ...pickSectionConfig(profile, section) }
                : {};
            sectionSources[section] = { state, folderId: folder.id };
        }

        const identityState = getLocalSectionState(inheritance, protocol, "identities");
        if (identityState !== "transparent") {
            const legacyIdentities = (!inheritance.config?.protocol || inheritance.config.protocol === protocol)
                ? inheritance.identities
                : undefined;
            const storedIdentities = identityRowsByFolder.get(folder.id)?.filter((row) => row.protocol === protocol).map((row) => row.identityId);
            identities = identityState === "enabled"
                ? [...(storedIdentities || inheritance.identityProfiles?.[protocol] || legacyIdentities || [])]
                : [];
            sectionSources.identities = { state: identityState, folderId: folder.id };
        }
    }

    return {
        config: { ...sectionConfig.details, ...sectionConfig.settings },
        identities,
        sectionSources,
    };
};

const loadFolderInheritance = async (folderId, protocol, options) => {
    const lineage = await getFolderLineage(folderId, options);
    const folderIds = lineage.map((folder) => folder.id);
    const where = { folderId: { [Op.in]: folderIds } };
    if (protocol) where.protocol = protocol;
    if (options.accountId !== undefined) where[Op.or] = [{ accountId: null }, { accountId: options.accountId }];
    const identityRows = folderIds.length ? await FolderIdentityProfile.findAll({
        where,
        order: [["position", "ASC"], ["id", "ASC"]],
        transaction: options.transaction,
    }) : [];
    let visibleIdentityRows = identityRows;
    if (options.sharedOnly) {
        const identityIds = [...new Set(identityRows.map((row) => row.identityId))];
        const identityModels = identityIds.length ? await Identity.findAll({ where: { id: identityIds }, transaction: options.transaction }) : [];
        const allowedIds = new Set(identityModels.filter((identity) => options.organizationId
            ? identity.organizationId === options.organizationId
            : identity.accountId === options.ownerAccountId).map((identity) => identity.id));
        visibleIdentityRows = identityRows.filter((row) => allowedIds.has(row.identityId));
    }
    const identityRowsByFolder = new Map();
    visibleIdentityRows.forEach((row) => identityRowsByFolder.set(row.folderId, [...(identityRowsByFolder.get(row.folderId) || []), row]));
    const protocols = getKnownProtocols(lineage, protocol, visibleIdentityRows);
    const profiles = {};
    const identityProfiles = {};
    const sectionSources = {};

    for (const profileProtocol of protocols) {
        const resolved = resolveProtocol(lineage, profileProtocol, identityRowsByFolder);
        profiles[profileProtocol] = resolved.config;
        identityProfiles[profileProtocol] = resolved.identities;
        sectionSources[profileProtocol] = resolved.sectionSources;
    }

    if (!protocol) return { config: {}, identities: [], profiles, identityProfiles, sectionSources };
    return { config: profiles[protocol], identities: identityProfiles[protocol], profiles, identityProfiles, sectionSources: sectionSources[protocol] };
};

// Bulk callers pass options.cache (a Map) to resolve each folder lineage once per pass
const getFolderInheritance = async (folderId, protocol = null, options = {}) => {
    if (!options.cache) return loadFolderInheritance(folderId, protocol, options);
    const key = JSON.stringify([folderId, protocol, options.accountId, options.sharedOnly, options.organizationId, options.ownerAccountId]);
    if (!options.cache.has(key)) options.cache.set(key, loadFolderInheritance(folderId, protocol, options));
    return options.cache.get(key);
};

const getParentFolderInheritance = async (folderId, options = {}) => {
    const folder = await Folder.findByPk(folderId, options);
    return folder?.parentId ? getFolderInheritance(folder.parentId, null, options) : { config: {}, identities: [], profiles: {}, identityProfiles: {}, sectionSources: {} };
};

const getEffectiveEntryConfig = async (entry, options = {}) => {
    const config = withoutInheritance(entry.config);
    const inheritance = entry.folderId ? await getFolderInheritance(entry.folderId, config.protocol, options) : { config: {} };
    return { ...inheritance.config, ...config };
};

const mergeConfigWithProvenance = (inheritedConfig, localConfig) => ({
    config: { ...inheritedConfig, ...localConfig },
    inheritedFields: new Set(
        Object.keys(inheritedConfig || {}).filter((key) => !Object.hasOwn(localConfig || {}, key))
    ),
});

const applyEffectiveEntryConfig = async (entry, options = {}) => {
    const localConfig = withoutInheritance(entry.config);
    const inheritance = entry.folderId ? await getFolderInheritance(entry.folderId, localConfig.protocol, options) : { config: {} };
    const effective = mergeConfigWithProvenance(inheritance.config, localConfig);
    entry.inheritedConfigFields = effective.inheritedFields;
    entry.config = effective.config;
    return entry.config;
};

const getEntryIdentityIds = async (entry, options = {}) => {
    const directIdentities = await EntryIdentity.findAll({
        where: { entryId: entry.id },
        order: [["isDefault", "DESC"], ["createdAt", "ASC"]],
        transaction: options.transaction,
    });
    const directIds = directIdentities.map((identity) => identity.identityId);

    if (!entry.folderId) return directIds;

    const inheritedIds = (await getFolderInheritance(entry.folderId, withoutInheritance(entry.config).protocol, options)).identities;
    return [...directIds, ...inheritedIds.filter((identityId) => !directIds.includes(identityId))];
};

module.exports = {
    ALL_SECTIONS,
    CONFIG_SECTIONS,
    DETAIL_FIELDS,
    SUPPORTED_PROTOCOLS,
    INHERITANCE_KEY,
    applyEffectiveEntryConfig,
    changesProtocol,
    getConfigSection,
    getEffectiveEntryConfig,
    getEntryIdentityIds,
    getFolderInheritance,
    getFolderLineage,
    getInheritanceShapeError,
    getTemporaryIdentityReferenceError,
    getLocalProfiles,
    getLocalSectionState,
    getParentFolderInheritance,
    mergeConfigWithProvenance,
    omitsProtocol,
    pickSectionConfig,
    replaceSectionConfig,
    resolveProtocol,
    withoutInheritance,
};
