const PVEServer = require("../models/PVEServer");
const { hasOrganizationAccess, validateFolderAccess } = require("../utils/permission");

const validatePVEServerAccess = async (accountId, server, errorMessage = "You don't have permission to access this server") => {
    if (!server) return { valid: false, error: { code: 401, message: "Server does not exist" } };

    if (server.accountId && server.accountId !== accountId) {
        return { valid: false, error: { code: 403, message: errorMessage } };
    } else if (server.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, server.organizationId);
        if (!hasAccess) {
            return {
                valid: false,
                error: { code: 403, message: `You don't have access to this organization's server` },
            };
        }
    }
    return { valid: true, server };
};

module.exports.createPVEServer = async (accountId, configuration) => {
    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, configuration.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
    }

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) {
            return folderCheck.error;
        }

        if (folderCheck.folder.organizationId && !configuration.organizationId) {
            configuration.organizationId = folderCheck.folder.organizationId;
        }
    }

    return await PVEServer.create({ ...configuration, accountId: configuration.organizationId ? null : accountId });
};

module.exports.deletePVEServer = async (accountId, serverId) => {
    const server = await PVEServer.findByPk(serverId);
    const accessCheck = await validatePVEServerAccess(accountId, server, "You don't have permission to delete this server");

    if (!accessCheck.valid) return accessCheck.error;

    await PVEServer.destroy({ where: { id: serverId } });

    return { success: true };
};

module.exports.editPVEServer = async (accountId, serverId, configuration) => {
    const server = await PVEServer.findByPk(serverId);
    const accessCheck = await validatePVEServerAccess(accountId, server, "You don't have permission to edit this server");

    if (!accessCheck.valid) return accessCheck.error;

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) {
            return folderCheck.error;
        }

        if (server.organizationId && folderCheck.folder.organizationId !== server.organizationId) {
            return { code: 403, message: "Folder must belong to the same organization as the server" };
        } else if (!server.organizationId && folderCheck.folder.organizationId) {
            return { code: 403, message: "Cannot move a personal server to an organization folder" };
        }
    }

    delete configuration.accountId;
    delete configuration.organizationId;

    await PVEServer.update(configuration, { where: { id: serverId } });

    return { success: true };
};

module.exports.getPVEServerUnsafe = async (accountId, serverId) => {
    const server = await PVEServer.findByPk(serverId);
    const accessCheck = await validatePVEServerAccess(accountId, server);

    if (!accessCheck.valid) return accessCheck.error;

    return server;
};

module.exports.getPVEServer = async (accountId, serverId) => {
    const server = await this.getPVEServerUnsafe(accountId, serverId);
    if (server.code) return server;
    return { ...server, password: undefined };
};