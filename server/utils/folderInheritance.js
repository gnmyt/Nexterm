const Folder = require("../models/Folder");
const EntryIdentity = require("../models/EntryIdentity");
const FolderIdentityProfile = require("../models/FolderIdentityProfile");
const Identity = require("../models/Identity");
const { Op } = require("sequelize");
const { configValidation } = require("../validations/server");
const { FOLDER_PROFILE_PROTOCOLS } = require("../validations/folder");

const INHERITANCE_KEY = "__nextermInheritance";
const NON_INHERITABLE_FIELDS = ["protocol", "ip", "macAddress", "wolBroadcastAddress", "nodeName", "vmid"];

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const getLocalProfiles = (folder) => folder?.config?.[INHERITANCE_KEY]?.profiles || {};

const withProfiles = (config, profiles) => ({ ...config, [INHERITANCE_KEY]: { profiles } });

const getProfilesError = (profiles) => {
    if (!isPlainObject(profiles)) return "Folder profiles must be an object";
    for (const [protocol, profile] of Object.entries(profiles)) {
        if (!FOLDER_PROFILE_PROTOCOLS.includes(protocol)) return "Folder profiles contain an unsupported protocol";
        if (!isPlainObject(profile)) return "Folder profiles must be objects";
        const forbidden = Object.keys(profile).find((key) => NON_INHERITABLE_FIELDS.includes(key));
        if (forbidden) return `"${forbidden}" cannot be set on a folder`;
        const { error } = configValidation.validate(profile);
        if (error) return error.message;
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

const changesProtocol = (currentConfig, nextConfig) => nextConfig?.protocol !== undefined
    && nextConfig.protocol !== currentConfig?.protocol;
const omitsProtocol = (nextConfig) => nextConfig !== undefined && nextConfig.protocol === undefined;

const FOLDER_MAP_CACHE_KEY = "__folders";

const getFolderLineage = async (folderId, { transaction, cache } = {}) => {
    if (!folderId) return [];

    let findFolder = (id) => Folder.findByPk(id, { transaction });
    if (cache) {
        if (!cache.has(FOLDER_MAP_CACHE_KEY)) {
            cache.set(FOLDER_MAP_CACHE_KEY, Folder.findAll({ transaction })
                .then((folders) => new Map(folders.map((folder) => [folder.id, folder]))));
        }
        const folders = await cache.get(FOLDER_MAP_CACHE_KEY);
        findFolder = (id) => folders.get(id);
    }

    const lineage = [];
    const visited = new Set();
    let folder = await findFolder(Number(folderId));
    while (folder && !visited.has(folder.id)) {
        visited.add(folder.id);
        lineage.unshift(folder);
        folder = folder.parentId ? await findFolder(folder.parentId) : null;
    }
    return lineage;
};

const resolveProtocol = (lineage, protocol, identityRowsByFolder = new Map()) => {
    let config = {};
    let identities = [];
    for (const folder of lineage) {
        config = { ...config, ...getLocalProfiles(folder)[protocol] };
        const rows = identityRowsByFolder.get(folder.id)?.filter((row) => row.protocol === protocol);
        if (rows?.length) identities = rows.map((row) => row.identityId);
    }
    return { config, identities };
};

const loadIdentityRows = async (folderIds, protocol, options) => {
    if (!folderIds.length) return [];
    const where = { folderId: { [Op.in]: folderIds } };
    if (protocol) where.protocol = protocol;
    if (options.accountId !== undefined) where[Op.or] = [{ accountId: null }, { accountId: options.accountId }];
    const rows = await FolderIdentityProfile.findAll({
        where,
        order: [["position", "ASC"], ["id", "ASC"]],
        transaction: options.transaction,
    });
    if (!options.sharedOnly || !rows.length) return rows;

    const identities = await Identity.findAll({
        where: { id: [...new Set(rows.map((row) => row.identityId))] },
        transaction: options.transaction,
    });
    const allowedIds = new Set(identities.filter((identity) => options.organizationId
        ? identity.organizationId === options.organizationId
        : identity.accountId === options.ownerAccountId).map((identity) => identity.id));
    return rows.filter((row) => allowedIds.has(row.identityId));
};

const loadFolderInheritance = async (folderId, protocol, options) => {
    const lineage = await getFolderLineage(folderId, options);
    const identityRows = await loadIdentityRows(lineage.map((folder) => folder.id), protocol, options);
    const identityRowsByFolder = new Map();
    identityRows.forEach((row) => identityRowsByFolder.set(row.folderId, [...(identityRowsByFolder.get(row.folderId) || []), row]));

    const protocols = protocol ? [protocol] : [...new Set([
        ...lineage.flatMap((folder) => Object.keys(getLocalProfiles(folder))),
        ...identityRows.map((row) => row.protocol),
    ])];
    const profiles = {};
    const identityProfiles = {};
    for (const profileProtocol of protocols) {
        const resolved = resolveProtocol(lineage, profileProtocol, identityRowsByFolder);
        profiles[profileProtocol] = resolved.config;
        identityProfiles[profileProtocol] = resolved.identities;
    }

    return {
        config: protocol ? profiles[protocol] : {},
        identities: protocol ? identityProfiles[protocol] : [],
        profiles,
        identityProfiles,
    };
};

const getFolderInheritance = async (folderId, protocol = null, options = {}) => {
    if (!options.cache) return loadFolderInheritance(folderId, protocol, options);
    const key = JSON.stringify([folderId, protocol, options.accountId, options.sharedOnly, options.organizationId, options.ownerAccountId]);
    if (!options.cache.has(key)) options.cache.set(key, loadFolderInheritance(folderId, protocol, options));
    return options.cache.get(key);
};

const getEffectiveEntryConfig = async (entry, options = {}) => {
    const inherited = entry.folderId ? (await getFolderInheritance(entry.folderId, entry.config?.protocol, options)).config : {};
    return { ...inherited, ...entry.config };
};

const applyEffectiveEntryConfig = async (entry, options = {}) => {
    if (!entry.hasEffectiveConfig) {
        entry.config = await getEffectiveEntryConfig(entry, options);
        entry.hasEffectiveConfig = true;
    }
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

    const inheritedIds = (await getFolderInheritance(entry.folderId, entry.config?.protocol, options)).identities;
    return [...directIds, ...inheritedIds.filter((identityId) => !directIds.includes(identityId))];
};

module.exports = {
    applyEffectiveEntryConfig,
    changesProtocol,
    getEffectiveEntryConfig,
    getEntryIdentityIds,
    getFolderInheritance,
    getLocalProfiles,
    getProfilesError,
    getTemporaryIdentityReferenceError,
    omitsProtocol,
    withProfiles,
};
