const Folder = require("../models/Folder");
const Entry = require("../models/Entry");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const { Op } = require("sequelize");
const { hasOrganizationAccess } = require("../utils/permission");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");
const stateBroadcaster = require("../lib/StateBroadcaster");

const updateFolderContext = async (folderId, organizationId, accountId) => {
    await Folder.update(
        { organizationId, accountId },
        { where: { id: folderId } }
    );

    await Entry.update(
        { organizationId, accountId },
        { where: { folderId } }
    );

    const subfolders = await Folder.findAll({ where: { parentId: folderId } });
    for (const subfolder of subfolders) {
        await updateFolderContext(subfolder.id, organizationId, accountId);
    }
};

module.exports.createFolder = async (accountId, configuration) => {
    if (configuration.parentId && !configuration.organizationId) {
        const parentFolder = await Folder.findByPk(configuration.parentId);
        if (parentFolder === null) {
            return { code: 302, message: "Parent folder does not exist" };
        }

        if (parentFolder.organizationId) {
            configuration.organizationId = parentFolder.organizationId;
        }
    }

    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, configuration.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
    }

    if (configuration.parentId) {
        const parentFolder = await Folder.findByPk(configuration.parentId);
        if (parentFolder === null) {
            return { code: 302, message: "Parent folder does not exist" };
        }

        if (configuration.organizationId && parentFolder.organizationId !== configuration.organizationId) {
            return { code: 403, message: "Parent folder must be in the same organization" };
        } else if (!configuration.organizationId && parentFolder.accountId !== accountId) {
            return { code: 403, message: "You don't have access to the parent folder" };
        }
    }

    const folder = await Folder.create({
        name: configuration.name,
        accountId: configuration.organizationId ? null : accountId,
        organizationId: configuration.organizationId || null,
        parentId: configuration.parentId,
    });

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_CREATE_MGMT,
        accountId,
        organizationId: configuration.organizationId || null,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folder.id,
        details: { folderName: configuration.name },
    });

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: configuration.organizationId });

    return folder;
};

module.exports.deleteFolder = async (accountId, folderId) => {
    const folder = await Folder.findByPk(folderId);

    if (folder === null) {
        return { code: 301, message: "Folder does not exist" };
    }

    if (folder.accountId && folder.accountId !== accountId) {
        return { code: 403, message: "You don't have permission to delete this folder" };
    } else if (folder.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, folder.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
    }

    let subfolders = await Folder.findAll({ where: { parentId: folderId } });
    for (let subfolder of subfolders) {
        await module.exports.deleteFolder(accountId, subfolder.id);
    }

    await Entry.destroy({ where: { folderId: folderId } });

    await Folder.destroy({ where: { id: folderId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_DELETE_MGMT,
        accountId,
        organizationId: folder.organizationId,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folderId,
        details: { folderName: folder.name },
    });

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: folder.organizationId });

    return { success: true };
};

module.exports.editFolder = async (accountId, folderId, configuration) => {
    const folder = await Folder.findByPk(folderId);

    if (folder === null) {
        return { code: 301, message: "Folder does not exist" };
    }

    if (folder.accountId && folder.accountId !== accountId) {
        return { code: 403, message: "You don't have permission to edit this folder" };
    } else if (folder.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, folder.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization's folders" };
        }
    }

    if (configuration.parentId !== undefined) {
        if (configuration.parentId === null) {
            if (configuration.organizationId !== undefined) {
                const targetOrgId = configuration.organizationId;
                if (targetOrgId !== null) {
                    const hasAccess = await hasOrganizationAccess(accountId, targetOrgId);
                    if (!hasAccess) {
                        return { code: 403, message: "You don't have access to the target organization" };
                    }
                }
                
                const newOrganizationId = targetOrgId;
                const newAccountId = targetOrgId ? null : accountId;
                
                if (folder.organizationId !== newOrganizationId) {
                    await updateFolderContext(parseInt(folderId), newOrganizationId, newAccountId);
                }
            } else {
                const newOrganizationId = null;
                const newAccountId = accountId;
                
                if (folder.organizationId !== newOrganizationId) {
                    await updateFolderContext(parseInt(folderId), newOrganizationId, newAccountId);
                }
            }
        } else {
            let targetFolder = await Folder.findByPk(configuration.parentId);
            if (!targetFolder) {
                return { code: 302, message: "Target parent folder does not exist" };
            }

            if (folder.organizationId && !targetFolder.organizationId) {
                const hasOrgAccess = await hasOrganizationAccess(accountId, folder.organizationId);
                if (!hasOrgAccess) {
                    return { code: 403, message: "You don't have access to this organization's folder" };
                }
            }

            if (targetFolder.organizationId && !folder.organizationId) {
                const hasOrgAccess = await hasOrganizationAccess(accountId, targetFolder.organizationId);
                if (!hasOrgAccess) {
                    return { code: 403, message: "You don't have access to the target organization" };
                }
            }

            if (folder.organizationId && targetFolder.organizationId && targetFolder.organizationId !== folder.organizationId) {
                const hasSourceAccess = await hasOrganizationAccess(accountId, folder.organizationId);
                const hasTargetAccess = await hasOrganizationAccess(accountId, targetFolder.organizationId);
                if (!hasSourceAccess || !hasTargetAccess) {
                    return { code: 403, message: "You don't have access to one or both organizations" };
                }
            } else if (!folder.organizationId && !targetFolder.organizationId) {
                if (targetFolder.accountId !== accountId) {
                    return { code: 403, message: "You don't have access to the target parent folder" };
                }
            }

            let currentFolder = targetFolder;
            while (currentFolder) {
                if (currentFolder.id === parseInt(folderId)) {
                    return { code: 303, message: "Cannot move folder to its own subfolder" };
                }

                if (currentFolder.parentId === null) {
                    break;
                }

                currentFolder = await Folder.findByPk(currentFolder.parentId);
            }

            const newOrganizationId = targetFolder.organizationId || null;
            const newAccountId = targetFolder.organizationId ? null : accountId;
            
            if (folder.organizationId !== newOrganizationId) {
                await updateFolderContext(parseInt(folderId), newOrganizationId, newAccountId);
            }
        }
    }

    delete configuration.accountId;
    delete configuration.organizationId;

    await Folder.update(configuration, { where: { id: folderId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_UPDATE_MGMT,
        accountId,
        organizationId: folder.organizationId,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folderId,
        details: configuration,
    });

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: folder.organizationId });

    return { success: true };
};

module.exports.listFolders = async (accountId) => {
    const personalFolders = await Folder.findAll({
        where: { accountId: accountId },
        order: [["parentId", "ASC"], ["position", "ASC"]],
    });

    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    const organizationIds = memberships.map(m => m.organizationId);

    let organizationFolders = [];
    if (organizationIds.length > 0) {
        organizationFolders = await Folder.findAll({
            where: { organizationId: { [Op.in]: organizationIds } },
            order: [["organizationId", "ASC"], ["parentId", "ASC"], ["position", "ASC"]],
        });
    }

    const allFolders = [...personalFolders, ...organizationFolders];

    const folderMap = new Map();
    let rootFolders = [];

    allFolders.forEach(folder => {
        folderMap.set(folder.id, {
            id: folder.id,
            name: folder.name,
            type: "folder",
            folderType: folder.type,
            position: folder.position,
            organizationId: folder.organizationId,
            entries: [],
        });
    });

    allFolders.forEach(folder => {
        if (folder.parentId) {
            const parentFolder = folderMap.get(folder.parentId);
            if (parentFolder) {
                parentFolder.entries.push(folderMap.get(folder.id));
            } else {
                rootFolders.push(folderMap.get(folder.id));
            }
        } else {
            rootFolders.push(folderMap.get(folder.id));
        }
    });

    const result = [];

    const personalRootFolders = rootFolders.filter(f => !f.organizationId);
    if (personalRootFolders.length > 0) {
        result.push(...personalRootFolders);
    }

    if (organizationIds.length > 0) {
        const organizations = await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });

        const orgFoldersByOrg = {};
        rootFolders.forEach(folder => {
            if (folder.organizationId) {
                if (!orgFoldersByOrg[folder.organizationId]) {
                    orgFoldersByOrg[folder.organizationId] = [];
                }
                orgFoldersByOrg[folder.organizationId].push(folder);
            }
        });

        organizations.forEach(org => {
            let requireConnectionReason = false;
            if (org.auditSettings) {
                const settings = typeof org.auditSettings === "string" ? JSON.parse(org.auditSettings) : org.auditSettings;
                requireConnectionReason = settings.requireConnectionReason || false;
            }

            result.push({
                id: `org-${org.id}`,
                name: org.name,
                type: "organization",
                requireConnectionReason,
                entries: orgFoldersByOrg[org.id] || [],
            });
        });
    }

    return result;
};

module.exports.getFolderById = async (accountId, folderId) => {
    const folder = await Folder.findByPk(folderId);

    if (!folder) {
        return { code: 301, message: "Folder does not exist" };
    }

    if (folder.accountId && folder.accountId !== accountId) {
        return { code: 403, message: "You don't have permission to access this folder" };
    } else if (folder.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, folder.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization's folder" };
        }
    }

    return folder;
};
