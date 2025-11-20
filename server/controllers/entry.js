const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Folder = require("../models/Folder");
const { listFolders } = require("./folder");
const { hasOrganizationAccess, validateFolderAccess } = require("../utils/permission");
const { Op } = require("sequelize");
const OrganizationMember = require("../models/OrganizationMember");
const { listIdentities } = require("./identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");

const validateEntryAccess = async (accountId, entry, errorMessage = "You don't have permission to access this entry") => {
    if (!entry) return { code: 401, message: "Entry does not exist" };

    if (entry.folderId) {
        const folder = await Folder.findByPk(entry.folderId);
        if (folder) {
            if (folder.accountId && folder.accountId !== accountId) {
                return { code: 403, message: errorMessage };
            } else if (folder.organizationId) {
                const hasAccess = await hasOrganizationAccess(accountId, folder.organizationId);
                if (!hasAccess) {
                    return { code: 403, message: `You don't have access to this organization's entry` };
                }
            }
        }
    } else if (entry.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, entry.organizationId);
        if (!hasAccess) {
            return { code: 403, message: `You don't have access to this organization's entry` };
        }
    }
    return { valid: true, entry };
};

const validateIdentities = async (accountId, identities, organizationId) => {
    if (!identities || identities.length === 0) return { valid: true };

    const allAccessibleIdentities = await listIdentities(accountId);
    const accessibleIdentityIds = allAccessibleIdentities.map(identity => identity.id);

    const invalidIdentities = identities.filter(id => !accessibleIdentityIds.includes(id));

    if (invalidIdentities.length > 0) {
        return {
            valid: false,
            error: { code: 501, message: "One or more identities do not exist or you don't have access to them" },
        };
    }

    if (organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, organizationId);
        if (!hasAccess) {
            return { valid: false, error: { code: 403, message: "You don't have access to this organization" } };
        }
    }

    return { valid: true };
};

module.exports.createEntry = async (accountId, configuration) => {
    let folder = null;
    if (configuration.folderId) {
        folder = await validateFolderAccess(accountId, configuration.folderId);
        if (!folder.valid) return folder.error;
    }

    if (!configuration.icon) {
        configuration.icon = "server";
    }

    if (!configuration.renderer && configuration.config?.protocol) {
        if (configuration.config.protocol === "ssh") {
            configuration.renderer = "terminal";
        } else if (configuration.config.protocol === "rdp" || configuration.config.protocol === "vnc") {
            configuration.renderer = "guac";
        }
    }

    if (configuration.identities && configuration.identities.length > 0) {
        const validationResult = await validateIdentities(accountId, configuration.identities, configuration.organizationId);
        if (!validationResult.valid) return validationResult.error;
    }

    const organizationId = folder?.folder?.organizationId || configuration.organizationId || null;
    
    const entry = await Entry.create({
        ...configuration,
        accountId: organizationId ? null : accountId,
        organizationId: organizationId,
        folderId: configuration.folderId || null,
    });

    if (configuration.identities && configuration.identities.length > 0) {
        for (let i = 0; i < configuration.identities.length; i++) {
            await EntryIdentity.create({
                entryId: entry.id,
                identityId: configuration.identities[i],
                isDefault: i === 0,
            });
        }
    }

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

    return entry;
};

module.exports.deleteEntry = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to delete this entry");

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

    return { success: true };
};

module.exports.editEntry = async (accountId, entryId, configuration) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to edit this entry");

    if (!accessCheck.valid) return accessCheck;

    if (configuration.folderId !== undefined && configuration.folderId !== null) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) return folderCheck.error;
    }

    if (configuration.config?.protocol) {
        if (configuration.config.protocol === "ssh") {
            configuration.renderer = "terminal";
        } else if (configuration.config.protocol === "rdp" || configuration.config.protocol === "vnc") {
            configuration.renderer = "guac";
        }
    }

    if (configuration.identities) {
        const validationResult = await validateIdentities(accountId, configuration.identities, entry.organizationId);
        if (!validationResult.valid) return validationResult.error;

        await EntryIdentity.destroy({ where: { entryId } });

        if (configuration.identities.length > 0) {
            for (let i = 0; i < configuration.identities.length; i++) {
                await EntryIdentity.create({
                    entryId,
                    identityId: configuration.identities[i],
                    isDefault: i === 0,
                });
            }
        }
        delete configuration.identities;
    }

    delete configuration.organizationId;

    await Entry.update(configuration, { where: { id: entryId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_UPDATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entryId,
        details: configuration
    });

    return { success: true };
};

module.exports.getEntry = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry);

    if (!accessCheck.valid) return accessCheck;

    const identities = await EntryIdentity.findAll({ where: { entryId }, order: [['isDefault', 'DESC']] });

    return {
        ...entry,
        identities: identities.map(ei => ei.identityId)
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

    const buildEntryObject = (entry, identities) => {
        const obj = {
            type: entry.type,
            id: entry.id,
            icon: entry.icon,
            name: entry.name,
            status: entry.status,
            position: entry.position,
            renderer: entry.renderer,
        };

        if (entry.type === 'server') {
            return {
                ...obj,
                identities: identities,
                protocol: entry.config?.protocol,
                ip: entry.config?.ip,
            };
        }

        return obj;
    };

    for (const entry of entries) {
        const identities = identitiesMap.get(entry.id) || [];
        const entryObject = buildEntryObject(entry, identities);
        
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

    const accessCheck = await validateEntryAccess(accountId, entry);
    if (!accessCheck.valid) return accessCheck;

    const identities = await EntryIdentity.findAll({ where: { entryId }, order: [['isDefault', 'DESC']] });

    const newEntry = await Entry.create({
        ...entry,
        id: undefined,
        name: entry.name + " (Copy)",
    });

    for (const identity of identities) {
        await EntryIdentity.create({
            entryId: newEntry.id,
            identityId: identity.identityId,
            isDefault: identity.isDefault,
        });
    }

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_CREATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: newEntry.id,
        details: { name: newEntry.name, folderId: newEntry.folderId }
    });

    return newEntry;
};

module.exports.importSSHConfig = async (accountId, configuration) => {
    const { servers, folderId } = configuration;
    const folderCheck = await validateFolderAccess(accountId, folderId);
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

    return {
        message: `SSH config import: ${results.imported} imported, ${results.skipped} skipped, ${results.errors} errors`,
        ...results
    };
};

module.exports.repositionEntry = async (accountId, entryId, { targetId, placement, folderId, organizationId }) => {
    const entryIdNum = parseInt(entryId);
    
    const entry = await Entry.findByPk(entryIdNum);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to reposition this entry");

    if (!accessCheck.valid) return accessCheck;

    if (folderId !== undefined && folderId !== null) {
        const folderCheck = await validateFolderAccess(accountId, folderId);
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
            const hasAccess = await hasOrganizationAccess(accountId, targetOrganizationId);
            if (!hasAccess) {
                return { code: 403, message: "You don't have access to this organization" };
            }
            targetAccountId = null;
        } else {
            targetOrganizationId = null;
            targetAccountId = accountId;
        }
    }

    const entries = await Entry.findAll({
        where: {
            folderId: targetFolderId,
            organizationId: targetOrganizationId,
            accountId: targetAccountId,
        },
        order: [["position", "ASC"]],
    });

    const normalizedEntries = entries.filter(e => e.id !== entryIdNum);
    
    let targetIndex;
    if (targetId === null || targetId === undefined) {
        targetIndex = normalizedEntries.length;
    } else {
        targetIndex = normalizedEntries.findIndex(e => e.id === parseInt(targetId));
        if (targetIndex === -1) return { code: 404, message: "Target entry not found" };

        if (placement === 'after') {
            targetIndex += 1;
        }
    }

    normalizedEntries.splice(targetIndex, 0, entry);

    for (let i = 0; i < normalizedEntries.length; i++) {
        const updateData = { position: i, folderId: targetFolderId };
        
        if (normalizedEntries[i].id === entryIdNum) {
            updateData.organizationId = targetOrganizationId;
            updateData.accountId = targetAccountId;
        }
        
        await Entry.update(updateData, { where: { id: normalizedEntries[i].id } });
    }

    await createAuditLog({
        action: AUDIT_ACTIONS.ENTRY_UPDATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.ENTRY,
        resourceId: entryIdNum,
        details: { action: 'reposition', targetId, placement, folderId: targetFolderId }
    });

    return { success: true };
};

module.exports.validateEntryAccess = validateEntryAccess;
