const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Integration = require("../models/Integration");
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

    if (configuration.identities && configuration.identities.length > 0) {
        const validationResult = await validateIdentities(accountId, configuration.identities, configuration.organizationId);
        if (!validationResult.valid) return validationResult.error;
    }

    const entry = await Entry.create({
        ...configuration,
        accountId: folder?.folder?.organizationId ? null : accountId,
        organizationId: folder?.folder?.organizationId || null,
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
        action: AUDIT_ACTIONS.SERVER_CREATE,
        accountId,
        organizationId: folder?.folder?.organizationId || null,
        resource: RESOURCE_TYPES.SERVER,
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
        action: AUDIT_ACTIONS.SERVER_DELETE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.SERVER,
        resourceId: entryId,
        details: { name: entry.name, folderId: entry.folderId }
    });

    return { success: true };
};

module.exports.editEntry = async (accountId, entryId, configuration) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to edit this entry");

    if (!accessCheck.valid) return accessCheck;

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) return folderCheck.error;
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
        action: AUDIT_ACTIONS.SERVER_UPDATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.SERVER,
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

    const integrationIds = [...new Set(entries.filter(e => e.integrationId).map(e => e.integrationId))];
    const allIntegrations = await Integration.findAll({
        where: { id: { [Op.in]: integrationIds } }
    });
    const integrationsMap = new Map(allIntegrations.map(i => [i.id, i]));

    const folderIntegrations = await Integration.findAll({
        where: {
            [Op.or]: [
                { organizationId: { [Op.in]: organizationIds } },
                { organizationId: null },
            ],
        },
    });

    const folderMap = new Map();
    const rebuildFolderMap = (folders) => {
        folders.forEach(folder => {
            folderMap.set(folder.id, folder);
            if (folder.entries && folder.entries.length > 0) rebuildFolderMap(folder.entries);
        });
    };
    rebuildFolderMap(folders);

    for (const entry of entries) {
        const identities = identitiesMap.get(entry.id) || [];

        const folder = folderMap.get(entry.folderId);
        if (folder) {
            if (entry.type === 'server') {
                folder.entries.push({
                    type: "server",
                    id: entry.id,
                    icon: entry.icon,
                    name: entry.name,
                    position: entry.position,
                    identities: identities,
                    renderer: entry.renderer,
                    protocol: entry.config?.protocol,
                    ip: entry.config?.ip,
                });
            } else if (entry.type.startsWith('pve-')) {
                folder.entries.push({
                    type: entry.type,
                    id: entry.id,
                    name: entry.name,
                    status: entry.status,
                    position: entry.position,
                    renderer: entry.renderer,
                });
            }
        }
    }

    for (const integration of folderIntegrations) {
        const pveEntries = entries.filter(e => e.integrationId === integration.id && e.type.startsWith('pve-'));

        if (pveEntries.length > 0) {
            const firstEntry = pveEntries[0];
            const folder = folderMap.get(firstEntry.folderId);

            if (folder && folder.parentId) {
                const parentFolder = folderMap.get(folder.parentId);
                if (parentFolder) {
                    const existingPveServer = parentFolder.entries.find(e =>
                        e.type === 'pve-server' && e.id === integration.id
                    );

                    if (!existingPveServer) {
                        parentFolder.entries.push({
                            type: "pve-server",
                            id: integration.id,
                            name: folder.name,
                            online: integration.status === 'online',
                            entries: pveEntries.map(e => ({
                                type: e.type,
                                id: e.id,
                                name: e.name,
                                status: e.status,
                            })),
                            ip: integration.config?.ip,
                        });
                    }
                }
            }
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
        action: AUDIT_ACTIONS.SERVER_CREATE,
        accountId,
        organizationId: entry.organizationId,
        resource: RESOURCE_TYPES.SERVER,
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
                action: AUDIT_ACTIONS.SERVER_CREATE,
                accountId,
                organizationId: orgId || null,
                resource: RESOURCE_TYPES.SERVER,
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

module.exports.validateEntryAccess = validateEntryAccess;
