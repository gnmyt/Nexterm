const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Folder = require("../models/Folder");
const EntryTag = require("../models/EntryTag");
const Tag = require("../models/Tag");
const AuditLog = require("../models/AuditLog");
const { listFolders } = require("./folder");
const { hasOrganizationAccess, hasOrganizationPermission, hasAccountPermission, validateFolderAccess } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { Op } = require("sequelize");
const Identity = require("../models/Identity");
const OrganizationMember = require("../models/OrganizationMember");
const Credential = require("../models/Credential");
const FolderIdentityProfile = require("../models/FolderIdentityProfile");
const { listIdentities, createIdentityInTransaction, updateIdentityInTransaction } = require("./identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");
const logger = require("../utils/logger");
const { sendWakeOnLan } = require("../utils/wol");
const stateBroadcaster = require("../lib/StateBroadcaster");
const SessionManager = require("../lib/SessionManager");
const { changesProtocol, omitsProtocol, getFolderInheritance, getEffectiveEntryConfig, getEntryIdentityIds } = require("../utils/folderInheritance");
const { getAllowedPersonalAccountIds, removeUnavailableEntryIdentities } = require("../utils/scopeMove");
const sequelize = require("../utils/database");
const { getEntryScope, isIdentityAllowedForScope, isSameSecurityScope, validateIdentityIds, validateJumpHostIds } = require("../utils/resourceValidation");

const PROTOCOL_RENDERERS = {
    ssh: "terminal",
    telnet: "terminal",
    rdp: "guac",
    vnc: "guac",
    demo: "guac",
    sftp: "sftp",
    ftp: "sftp",
    ftps: "sftp",
};

const validateEntryAccess = async (accountId, entry, errorMessage = "You don't have permission to access this entry", requiredPermission = null) => {
    if (!entry) return { code: 401, message: "Entry does not exist" };

    const { organizationId, accountId: ownerAccountId } = await getEntryScope(entry);

    if (organizationId) {
        const allowed = requiredPermission
            ? await hasOrganizationPermission(accountId, organizationId, requiredPermission)
            : await hasOrganizationAccess(accountId, organizationId);
        if (!allowed) return { code: 403, message: `You don't have access to this organization's entry` };
    } else if (ownerAccountId && ownerAccountId !== accountId) {
        return { code: 403, message: errorMessage };
    } else if (requiredPermission && !(await hasAccountPermission(accountId, requiredPermission))) {
        return { code: 403, message: errorMessage };
    }
    return { valid: true, entry };
};


const lifecycleError = (result) => {
    const error = new Error(result.message);
    error.lifecycleError = { code: result.code, message: result.message };
    return error;
};

const identityIdOf = (item) => typeof item === "number" ? item : item.id;

const saveIdentities = async (accountId, entryId, organizationId, items, transaction) => {
    const identityIds = [];
    const events = [];
    for (const item of items) {
        if (typeof item === "number") {
            identityIds.push(item);
            continue;
        }
        const { id, global, ...config } = item;
        if (!id) {
            if (config.organizationId && config.organizationId !== organizationId) {
                throw lifecycleError({ code: 400, message: "New identities must be in the same organization as the server" });
            }
            const identity = await createIdentityInTransaction(accountId, config, transaction, global ? null : entryId);
            if (identity.code) throw lifecycleError(identity);
            identityIds.push(identity.id);
            events.push({ action: AUDIT_ACTIONS.IDENTITY_CREATE, identity, config });
            continue;
        }

        const result = await updateIdentityInTransaction(accountId, id, config, transaction);
        if (result.code) throw lifecycleError(result);
        if (global === false) {
            const usedElsewhere = await EntryIdentity.count({ where: { identityId: id, entryId: { [Op.ne]: entryId } }, transaction })
                || await FolderIdentityProfile.count({ where: { identityId: id }, transaction });
            if (usedElsewhere) {
                throw lifecycleError({ code: 400, message: "This identity is still used by other servers or folders. Unlink it there before limiting it to this server." });
            }
        }
        if (global !== undefined) await Identity.update({ entryId: global ? null : entryId }, { where: { id }, transaction });
        identityIds.push(id);
        events.push({ action: AUDIT_ACTIONS.IDENTITY_UPDATE, identity: result.identity, config });
    }
    return { identityIds, events };
};

const logIdentityEvents = async (accountId, events) => {
    for (const { action, identity, config } of events) {
        await createAuditLog({
            action,
            accountId,
            organizationId: identity.organizationId || null,
            resource: RESOURCE_TYPES.IDENTITY,
            resourceId: identity.id,
            details: { identityName: config.name || identity.name, identityType: config.type || identity.type },
        });
    }
};

module.exports.createEntry = async (accountId, { identities = [], ...configuration }) => {
    let folder = null;
    if (configuration.folderId) {
        folder = await validateFolderAccess(accountId, configuration.folderId, Permission.RESOURCES_MANAGE);
        if (!folder.valid) return folder.error;
    }

    const organizationId = folder?.folder?.organizationId || configuration.organizationId || null;

    if (!configuration.icon) {
        configuration.icon = "server";
    }

    const inheritedConfig = configuration.folderId ? await getFolderInheritance(configuration.folderId, configuration.config?.protocol, { accountId }) : { config: {} };
    const effectiveConfig = { ...inheritedConfig.config, ...configuration.config };

    if (!configuration.renderer && effectiveConfig.protocol) {
        configuration.renderer = PROTOCOL_RENDERERS[effectiveConfig.protocol] ?? configuration.renderer;
    }

    const identityValidation = await validateIdentityIds(accountId, identities.map(identityIdOf).filter(Boolean), organizationId);
    if (!identityValidation.valid) return identityValidation.error;

    if (configuration.config?.jumpHosts !== undefined) {
        const validationResult = await validateJumpHostIds(accountId, configuration.config.jumpHosts, {
            enforceScope: true,
            organizationId,
            ownerAccountId: organizationId ? null : accountId,
        });
        if (!validationResult.valid) return validationResult.error;
    }

    if (organizationId && organizationId !== folder?.folder?.organizationId
        && !(await hasOrganizationPermission(accountId, organizationId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources in this organization" };
    }

    if (!organizationId && !(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources" };
    }

    let entry;
    let identityEvents = [];
    try {
        await sequelize.transaction(async (transaction) => {
            entry = await Entry.create({
                ...configuration,
                accountId: organizationId ? null : accountId,
                organizationId: organizationId,
                folderId: configuration.folderId || null,
            }, { transaction });

            const saved = await saveIdentities(accountId, entry.id, organizationId, identities, transaction);
            identityEvents = saved.events;
            for (let i = 0; i < saved.identityIds.length; i++) {
                await EntryIdentity.create({ entryId: entry.id, identityId: saved.identityIds[i], isDefault: i === 0 }, { transaction });
            }
        });
    } catch (error) {
        if (error.lifecycleError) return error.lifecycleError;
        throw error;
    }

    await logIdentityEvents(accountId, identityEvents);

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_CREATE,
        accountId,
        organizationId: folder?.folder?.organizationId || null,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entry.id,
        details: {
            name: entry.name,
            folderId: entry.folderId,
            type: entry.type,
            protocol: entry.config?.protocol,
        }
    });

    logger.info(`Entry created`, { entryId: entry.id, name: entry.name, type: entry.type });

    if (identityEvents.length) stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: entry.organizationId });
    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: entry.organizationId });

    return entry;
};

module.exports.deleteEntry = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to delete this entry", Permission.RESOURCES_MANAGE);

    if (!accessCheck.valid) return accessCheck;

    await Entry.destroy({ where: { id: entryId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_DELETE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entryId,
        details: { name: entry.name, folderId: entry.folderId }
    });

    logger.info(`Entry deleted`, { entryId, name: entry.name });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: entry.organizationId });
    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: entry.organizationId });

    return { success: true };
};

module.exports.editEntry = async (accountId, entryId, { identities, ...configuration }) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to edit this entry", Permission.RESOURCES_MANAGE);

    if (!accessCheck.valid) return accessCheck;

    if (configuration.folderId !== undefined || configuration.organizationId !== undefined)
        return { code: 400, message: "Move the server with the reposition endpoint" };

    if (entry.type === "server" && omitsProtocol(configuration.config)) {
        return { code: 400, message: "Server configuration updates must include the existing protocol" };
    }
    if (entry.type === "server" && changesProtocol(entry.config, configuration.config)) {
        return { code: 400, message: "Server protocol cannot be changed after creation" };
    }

    if (configuration.config?.protocol) {
        configuration.renderer = PROTOCOL_RENDERERS[configuration.config.protocol] ?? configuration.renderer;
    }

    const scope = await getEntryScope(entry);

    if (identities) {
        const validationResult = await validateIdentityIds(accountId, identities.map(identityIdOf).filter(Boolean), scope.organizationId, entry.id);
        if (!validationResult.valid) return validationResult.error;
    }

    if (configuration.config?.jumpHosts !== undefined) {
        const existingJumpHosts = new Set(entry.config?.jumpHosts || []);
        const jumpHosts = configuration.config.jumpHosts;
        const addedJumpHosts = Array.isArray(jumpHosts) ? jumpHosts.filter((jumpHostId) => !existingJumpHosts.has(jumpHostId)) : jumpHosts;
        const validationResult = await validateJumpHostIds(accountId, addedJumpHosts || [], {
            enforceScope: true,
            organizationId: scope.organizationId,
            ownerAccountId: scope.accountId || accountId,
        });
        if (!validationResult.valid) return validationResult.error;
    }

    const accessibleIdentityIds = identities ? new Set((await listIdentities(accountId)).map(i => i.id)) : null;
    let identityEvents = [];

    try {
        await sequelize.transaction(async (transaction) => {
            if (identities) {
                const saved = await saveIdentities(accountId, entry.id, scope.organizationId, identities, transaction);
                identityEvents = saved.events;

                const existingEntryIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, transaction });
                const toDelete = existingEntryIdentities.filter(ei => accessibleIdentityIds.has(ei.identityId)).map(ei => ei.identityId);
                if (toDelete.length > 0) {
                    await EntryIdentity.destroy({ where: { entryId: entry.id, identityId: { [Op.in]: toDelete } }, transaction });
                }

                const unlinkedIds = toDelete.filter((identityId) => !saved.identityIds.includes(identityId));
                await Identity.destroy({ where: { id: { [Op.in]: unlinkedIds }, entryId: entry.id }, transaction });

                const remainingIdentities = await EntryIdentity.findAll({ where: { entryId: entry.id }, transaction });
                const hasDefault = remainingIdentities.some(ei => ei.isDefault);
                for (let i = 0; i < saved.identityIds.length; i++) {
                    await EntryIdentity.create({
                        entryId: entry.id,
                        identityId: saved.identityIds[i],
                        isDefault: !hasDefault && i === 0,
                    }, { transaction });
                }
            }

            await Entry.update(configuration, { where: { id: entry.id }, transaction });
        });
    } catch (error) {
        if (error.lifecycleError) return error.lifecycleError;
        throw error;
    }

    await logIdentityEvents(accountId, identityEvents);

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_UPDATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entryId,
        details: configuration
    });

    if (identities) stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: scope.organizationId });
    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: entry.organizationId });

    return { success: true };
};

module.exports.getEntry = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry);

    if (!accessCheck.valid) return accessCheck;

    const accessibleIdentities = await listIdentities(accountId);
    const accessibleIdentitiesById = new Map(accessibleIdentities.map((identity) => [identity.id, identity]));
    const scope = await getEntryScope(entry);
    const isAllowedIdentity = (identityId) => isIdentityAllowedForScope(
        accessibleIdentitiesById.get(identityId), scope.organizationId, accountId
    );
    const directIdentities = await EntryIdentity.findAll({
        where: { entryId },
        order: [["isDefault", "DESC"]],
    });
    const directIdentityIds = directIdentities.map((identity) => identity.identityId);
    const identityIds = await getEntryIdentityIds(entry, { accountId });
    const filteredIdentityIds = identityIds.filter(isAllowedIdentity);
    const inherited = entry.folderId
        ? await getFolderInheritance(entry.folderId, entry.config?.protocol, { accountId })
        : { config: {}, identities: [] };

    return {
        ...entry,
        config: await getEffectiveEntryConfig(entry),
        localConfig: entry.config || {},
        inheritedConfig: inherited.config,
        identities: filteredIdentityIds,
        localIdentities: directIdentityIds.filter(isAllowedIdentity),
        inheritedIdentities: inherited.identities.filter(isAllowedIdentity),
    };
};

module.exports.listEntries = async (accountId) => {
    const folders = await listFolders(accountId, true);
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    const organizationIds = memberships.map(m => m.organizationId);

    const folderIds = [];
    const flattenFolders = (folders) => {
        folders.forEach(folder => {
            folderIds.push(folder.id);
            if (folder.entries && folder.entries.length > 0) flattenFolders(folder.entries);
        });
    };
    flattenFolders(folders);

    let entries = await Entry.findAll({
        where: {
            [Op.or]: [
                { folderId: { [Op.in]: folderIds } },
                { organizationId: { [Op.in]: organizationIds }, folderId: null },
                { accountId: accountId, folderId: null },
            ],
        },
        order: [["folderId", "ASC"], ["position", "ASC"]],
    });

    const entryIds = entries.map(e => e.id);
    const allEntryIdentities = entryIds.length ? await EntryIdentity.findAll({
        where: { entryId: { [Op.in]: entryIds } },
        order: [["isDefault", "DESC"], ["createdAt", "ASC"]],
    }) : [];
    const directIdentityMap = new Map();
    allEntryIdentities.forEach((row) => {
        directIdentityMap.set(row.entryId, [...(directIdentityMap.get(row.entryId) || []), row.identityId]);
    });
    const allEntryTags = await EntryTag.findAll({
        where: { entryId: { [Op.in]: entryIds } }
    });

    const allTags = await Tag.findAll({
        where: { accountId: accountId }
    });

    const accessibleIdentities = await listIdentities(accountId);
    const accessibleIdentitiesById = new Map(accessibleIdentities.map((identity) => [identity.id, identity]));
    const inheritanceCache = new Map();
    const getCachedInheritance = async (entry) => {
        if (!entry.folderId) return { config: {}, identities: [] };
        const protocol = entry.config?.protocol;
        const key = `${entry.folderId}:${protocol}`;
        if (!inheritanceCache.has(key)) inheritanceCache.set(key, await getFolderInheritance(entry.folderId, protocol, { accountId }));
        return inheritanceCache.get(key);
    };

    const tagsMap = new Map();
    allEntryTags.forEach(et => {
        if (!tagsMap.has(et.entryId)) {
            tagsMap.set(et.entryId, []);
        }
        const tag = allTags.find(t => t.id === et.tagId);
        if (tag) {
            tagsMap.get(et.entryId).push({ id: tag.id, name: tag.name, color: tag.color });
        }
    });

    const folderMap = new Map();
    const organizationMap = new Map();

    const rebuildFolderMap = (folders) => {
        folders.forEach(folder => {
            if (folder.type === 'organization') {
                organizationMap.set(parseInt(folder.id.split('-')[1]), folder);
                if (folder.entries && folder.entries.length > 0) rebuildFolderMap(folder.entries);
            } else {
                folderMap.set(folder.id, folder);
                if (folder.entries && folder.entries.length > 0) rebuildFolderMap(folder.entries);
            }
        });
    };
    rebuildFolderMap(folders);

    const buildEntryObject = (entry, config, identities, tags) => {
        const obj = {
            type: entry.type,
            id: entry.id,
            icon: entry.icon,
            name: entry.name,
            status: entry.status,
            position: entry.position,
            renderer: entry.renderer,
            folderId: entry.folderId || null,
            organizationId: entry.organizationId || null,
            tags: tags || [],
        };

        if (entry.type === 'server') {
            return {
                ...obj,
                identities: identities,
                protocol: config?.protocol,
                ip: config?.ip,
                macAddress: config?.macAddress,
                wakeOnLanEnabled: config?.wakeOnLanEnabled,
                notes: config?.notes || "",
                showNoteInList: Boolean(config?.showNoteInList),
                displayScale: config?.displayScale,
            };
        }

        if (entry.type?.startsWith('pve-')) {
            return { ...obj, integrationId: entry.integrationId };
        }

        return obj;
    };

    for (const entry of entries) {
        const inheritance = entry.type === "server"
            ? await getCachedInheritance(entry)
            : { config: {}, identities: [] };
        const localConfig = entry.config || {};
        const directIdentityIds = directIdentityMap.get(entry.id) || [];
        const identities = [...directIdentityIds, ...inheritance.identities.filter((id) => !directIdentityIds.includes(id))]
            .filter((id) => isIdentityAllowedForScope(accessibleIdentitiesById.get(id), entry.organizationId || null, accountId));
        const tags = tagsMap.get(entry.id) || [];
        const entryObject = buildEntryObject(entry, { ...inheritance.config, ...localConfig }, identities, tags);

        if (!entryObject) continue;

        if (entry.folderId) {
            const folder = folderMap.get(entry.folderId);
            if (folder) {
                folder.entries.push(entryObject);
            }
        } else if (entry.organizationId) {
            const organization = organizationMap.get(entry.organizationId);
            if (organization) {
                organization.entries.push(entryObject);
            }
        } else {
            folders.push(entryObject);
        }
    }

    return folders;
};

module.exports.duplicateEntry = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    if (!entry) return { code: 404, message: "Entry not found" };

    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to duplicate this entry", Permission.RESOURCES_MANAGE);
    if (!accessCheck.valid) return accessCheck;

    const identities = await EntryIdentity.findAll({ where: { entryId }, order: [['isDefault', 'DESC']] });

    const boundIdentities = new Map((await Identity.findAll({ where: { entryId: entry.id } })).map((identity) => [identity.id, identity]));
    const boundCredentials = boundIdentities.size
        ? await Credential.findAll({ where: { identityId: { [Op.in]: [...boundIdentities.keys()] } } })
        : [];

    let newEntry;
    await sequelize.transaction(async (transaction) => {
        newEntry = await Entry.create({
            ...entry,
            id: undefined,
            name: entry.name + " (Copy)",
        }, { transaction });

        for (const link of identities) {
            let identityId = link.identityId;
            const bound = boundIdentities.get(identityId);
            if (bound) {
                const copy = await Identity.create({
                    name: bound.name, type: bound.type, username: bound.username,
                    accountId: bound.accountId, organizationId: bound.organizationId, entryId: newEntry.id,
                }, { transaction });
                for (const credential of boundCredentials.filter((c) => c.identityId === bound.id && c.secret)) {
                    await Credential.create({ identityId: copy.id, type: credential.type, secret: credential.secret }, { transaction });
                }
                identityId = copy.id;
            }
            await EntryIdentity.create({ entryId: newEntry.id, identityId, isDefault: link.isDefault }, { transaction });
        }
    });

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_CREATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: newEntry.id,
        details: { name: newEntry.name, folderId: newEntry.folderId }
    });

    logger.info(`Entry duplicated`, { originalEntryId: entryId, newEntryId: newEntry.id, name: newEntry.name });

    if (boundIdentities.size) stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: entry.organizationId });
    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: entry.organizationId });

    return newEntry;
};

module.exports.importSSHConfig = async (accountId, configuration) => {
    const { servers, folderId } = configuration;
    const folderCheck = await validateFolderAccess(accountId, folderId, Permission.RESOURCES_MANAGE);
    if (!folderCheck.valid) return folderCheck.error;

    const results = { imported: 0, skipped: 0, errors: 0, details: [] };
    const orgId = folderCheck.folder?.organizationId;

    for (const serverData of servers) {
        try {
            const existingEntry = await Entry.findOne({
                where: { name: serverData.name, folderId, organizationId: orgId || null }
            });

            if (existingEntry) {
                results.skipped++;
                results.details.push({ host: serverData.name, status: 'skipped', reason: 'Entry exists' });
                continue;
            }

            const config = {
                ip: serverData.ip,
                port: serverData.port,
                protocol: "ssh",
                ...serverData.config,
            };

            const entry = await Entry.create({
                name: serverData.name,
                folderId,
                icon: "server",
                type: "server",
                renderer: "terminal",
                config,
                accountId: orgId ? null : accountId,
                organizationId: orgId || null,
            });

            if (serverData.identities && serverData.identities.length > 0) {
                for (let i = 0; i < serverData.identities.length; i++) {
                    await EntryIdentity.create({
                        entryId: entry.id,
                        identityId: serverData.identities[i],
                        isDefault: i === 0,
                    });
                }
            }

            await createAuditLog({
                action: AUDIT_ACTIONS.ENTRY_CREATE,
                accountId,
                organizationId: orgId || null,
                resource: RESOURCE_TYPES.ENTRY,
                resourceId: entry.id,
                details: { name: entry.name, folderId: entry.folderId, importSource: 'ssh-config' }
            });

            results.imported++;
            results.details.push({ host: serverData.name, status: 'imported', entryId: entry.id });
        } catch (error) {
            results.errors++;
            results.details.push({ host: serverData.name, status: 'error', reason: error.message });
        }
    }

    logger.info(`SSH config import completed`, { imported: results.imported, skipped: results.skipped, errors: results.errors });

    if (results.imported > 0) {
        stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: orgId });
    }

    return {
        message: `SSH config import: ${results.imported} imported, ${results.skipped} skipped, ${results.errors} errors`,
        ...results
    };
};

module.exports.repositionEntry = async (accountId, entryId, { targetId, placement, folderId, organizationId }) => {
    const entryIdNum = parseInt(entryId);

    const entry = await Entry.findByPk(entryIdNum);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to reposition this entry", Permission.RESOURCES_MANAGE);

    if (!accessCheck.valid) return accessCheck;

    if (entry.integrationId && folderId !== undefined && folderId !== entry.folderId) {
        return { code: 403, message: "Integration resources cannot be moved out of their node folder" };
    }

    if (folderId !== undefined && folderId !== null) {
        const folderCheck = await validateFolderAccess(accountId, folderId, Permission.RESOURCES_MANAGE);
        if (!folderCheck.valid) return folderCheck.error;
    }

    let targetFolderId = folderId !== undefined ? folderId : entry.folderId;
    let targetOrganizationId = organizationId !== undefined ? organizationId : null;
    let targetAccountId = accountId;

    if (targetFolderId) {
        const folder = await Folder.findByPk(targetFolderId);
        if (folder) {
            targetOrganizationId = folder.organizationId || null;
            targetAccountId = folder.organizationId ? null : accountId;
        }
    } else {
        if (targetOrganizationId) {
            const hasAccess = await hasOrganizationPermission(accountId, targetOrganizationId, Permission.RESOURCES_MANAGE);
            if (!hasAccess) {
                return { code: 403, message: "You don't have permission to manage resources in this organization" };
            }
            targetAccountId = null;
        } else {
            if (!(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
                return { code: 403, message: "You don't have permission to manage resources in the target location" };
            }
            targetOrganizationId = null;
            targetAccountId = accountId;
        }
    }

    const changesScope = !isSameSecurityScope(await getEntryScope(entry), { organizationId: targetOrganizationId, accountId: targetAccountId });
    if (changesScope) {
        const localJumpHostValidation = await validateJumpHostIds(accountId, entry.config?.jumpHosts, {
            enforceScope: true,
            skipMissing: true,
            organizationId: targetOrganizationId,
            ownerAccountId: targetAccountId,
        });
        if (!localJumpHostValidation.valid) return localJumpHostValidation.error;
    }

    const oldOrganizationId = entry.organizationId;
    let removedIdentityCount = 0;

    try {
        await sequelize.transaction(async (transaction) => {
            const entries = await Entry.findAll({
                where: {
                    folderId: targetFolderId,
                    organizationId: targetOrganizationId,
                    accountId: targetAccountId,
                },
                order: [["position", "ASC"]],
                transaction,
            });
            const normalizedEntries = entries.filter(e => e.id !== entryIdNum);

            let targetIndex;
            if (targetId === null || targetId === undefined) {
                targetIndex = normalizedEntries.length;
            } else {
                targetIndex = normalizedEntries.findIndex(e => e.id === parseInt(targetId));
                if (targetIndex === -1) {
                    const error = new Error("Target entry not found");
                    error.lifecycleError = { code: 404, message: error.message };
                    throw error;
                }
                if (placement === "after") targetIndex += 1;
            }

            normalizedEntries.splice(targetIndex, 0, entry);
            for (let i = 0; i < normalizedEntries.length; i++) {
                const updateData = { position: i, folderId: targetFolderId };
                if (normalizedEntries[i].id === entryIdNum) {
                    updateData.organizationId = targetOrganizationId;
                    updateData.accountId = targetAccountId;
                }
                await Entry.update(updateData, { where: { id: normalizedEntries[i].id }, transaction });
            }

            if (oldOrganizationId !== targetOrganizationId) {
                const allowedPersonalAccountIds = await getAllowedPersonalAccountIds(targetOrganizationId, accountId, transaction);
                removedIdentityCount = await removeUnavailableEntryIdentities([entryIdNum], targetOrganizationId, allowedPersonalAccountIds, transaction);
            }
        });
    } catch (error) {
        if (error.lifecycleError) return error.lifecycleError;
        throw error;
    }

    if (oldOrganizationId !== targetOrganizationId) await SessionManager.removeAllByEntryId(entryIdNum);

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_UPDATE,
        accountId,
        organizationId: oldOrganizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entryIdNum,
        details: { action: 'reposition', targetId, placement, folderId: targetFolderId, removedIdentityCount }
    });

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: oldOrganizationId });
    if (targetOrganizationId && targetOrganizationId !== oldOrganizationId) {
        stateBroadcaster.broadcast("ENTRIES", { organizationId: targetOrganizationId });
    }

    return { success: true, removedIdentityCount };
};

module.exports.wakeEntry = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry);
    if (!accessCheck.valid) return accessCheck;

    if (entry.type !== 'server') {
        return { code: 400, message: "Wake-On-LAN is only supported for server entries" };
    }

    const config = await getEffectiveEntryConfig(entry);
    const macAddress = config.macAddress;

    if (!macAddress) {
        return { code: 400, message: "No MAC address configured for this server" };
    }

    try {
        await sendWakeOnLan(macAddress, config.wolBroadcastAddress);
        return { success: true };
    } catch (error) {
        logger.error(`Failed to send Wake-On-LAN packet to ${macAddress}: ${error.message}`);
        return { code: 500, message: "Failed to send Wake-On-LAN packet" };
    }
};

module.exports.validateEntryAccess = validateEntryAccess;

module.exports.getRecentConnections = async (accountId, limit = 5) => {
    try {
        const memberships = await OrganizationMember.findAll({ 
            where: { accountId, status: "active" } 
        });
        const organizationIds = memberships.map(m => m.organizationId);

        const connectionActions = [
            AUDIT_ACTIONS.SSH_CONNECT,
            AUDIT_ACTIONS.SFTP_CONNECT,
            AUDIT_ACTIONS.PVE_CONNECT,
            AUDIT_ACTIONS.RDP_CONNECT,
            AUDIT_ACTIONS.VNC_CONNECT,
            AUDIT_ACTIONS.DEMO_CONNECT,
        ];

        const logs = await AuditLog.findAll({
            where: {
                action: { [Op.in]: connectionActions },
                resource: RESOURCE_TYPES.ENTRY,
                [Op.or]: [
                    { accountId, organizationId: null },
                    { organizationId: { [Op.in]: organizationIds } },
                ],
            },
            order: [["timestamp", "DESC"]],
            limit: limit * 3,
        });

        const seenEntries = new Set();
        const uniqueLogs = [];
        for (const log of logs) {
            if (!seenEntries.has(log.resourceId) && uniqueLogs.length < limit) {
                seenEntries.add(log.resourceId);
                uniqueLogs.push(log);
            }
        }

        const entryIds = uniqueLogs.map(log => log.resourceId);
        const entries = await Entry.findAll({
            where: { id: { [Op.in]: entryIds } },
        });
        const entryMap = new Map(entries.map(e => [e.id, e]));

        const allEntryIdentities = await EntryIdentity.findAll({
            where: { entryId: { [Op.in]: entryIds } },
            order: [['isDefault', 'DESC']]
        });
        const identitiesMap = new Map();
        allEntryIdentities.forEach(ei => {
            if (!identitiesMap.has(ei.entryId)) {
                identitiesMap.set(ei.entryId, []);
            }
            identitiesMap.get(ei.entryId).push(ei.identityId);
        });

        return uniqueLogs
            .map(log => {
                const entry = entryMap.get(log.resourceId);
                if (!entry) return null;

                return {
                    entryId: entry.id,
                    name: entry.name,
                    icon: entry.icon,
                    type: entry.type,
                    protocol: entry.config?.protocol || null,
                    connectionType: log.action,
                    timestamp: log.timestamp,
                    identities: identitiesMap.get(entry.id) || [],
                };
            })
            .filter(Boolean);
    } catch (error) {
        logger.error("Error getting recent connections", { error: error.message, accountId });
        return [];
    }
};
