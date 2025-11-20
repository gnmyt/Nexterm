const Integration = require("../models/Integration");
const Folder = require("../models/Folder");
const Credential = require("../models/Credential");
const { hasOrganizationAccess, validateFolderAccess } = require("../utils/permission");

const validateIntegrationAccess = async (accountId, integration) => {
    if (!integration) return { valid: false, error: { code: 401, message: "Integration does not exist" } };

    if (integration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, integration.organizationId);
        if (!hasAccess) {
            return {
                valid: false,
                error: { code: 403, message: `You don't have access to this organization's integration` },
            };
        }
    }
    return { valid: true, integration };
};

module.exports.createIntegration = async (accountId, configuration) => {
    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, configuration.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
    }

    let folder = null;
    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) {
            return folderCheck.error;
        }

        folder = folderCheck.folder;
        if (folder.organizationId && !configuration.organizationId) {
            configuration.organizationId = folder.organizationId;
        }
    }

    const integrationConfig = {
        ip: configuration.ip,
        port: configuration.port,
        username: configuration.username,
        nodeName: configuration.nodeName,
    };

    const integration = await Integration.create({
        organizationId: configuration.organizationId || null,
        type: configuration.type || 'proxmox',
        name: configuration.name,
        config: integrationConfig,
        status: configuration.online ? 'online' : 'offline',
    });

    if (configuration.password) {
        await Credential.create({
            integrationId: integration.id,
            type: 'password',
            secret: configuration.password,
        });
    }

    if (configuration.folderId) {
        await Folder.create({
            organizationId: configuration.organizationId || null,
            accountId: folder.accountId,
            parentId: configuration.folderId,
            name: configuration.name,
            position: 0,
        });
    }

    return integration;
};

module.exports.deleteIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, "You don't have permission to delete this integration");

    if (!accessCheck.valid) return accessCheck.error;

    const folder = await Folder.findOne({ where: { name: integration.name, organizationId: integration.organizationId } });
    if (folder) {
        await Folder.destroy({ where: { id: folder.id } });
    }

    await Integration.destroy({ where: { id: integrationId } });

    return { success: true };
};

module.exports.editIntegration = async (accountId, integrationId, configuration) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, "You don't have permission to edit this integration");

    if (!accessCheck.valid) return accessCheck.error;

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) {
            return folderCheck.error;
        }

        const folder = await Folder.findOne({ where: { name: integration.name, organizationId: integration.organizationId } });
        if (folder) {
            if (integration.organizationId && folderCheck.folder.organizationId !== integration.organizationId) {
                return { code: 403, message: "Folder must belong to the same organization as the integration" };
            } else if (!integration.organizationId && folderCheck.folder.organizationId) {
                return { code: 403, message: "Cannot move a personal integration to an organization folder" };
            }

            await Folder.update({ parentId: configuration.folderId }, { where: { id: folder.id } });
        }
    }

    if (configuration.password) {
        await Credential.destroy({ where: { integrationId, type: 'password' } });

        await Credential.create({
            integrationId,
            type: 'password',
            secret: configuration.password,
        });
        delete configuration.password;
    }

    const integrationConfig = {
        ...integration.config,
        ip: configuration.ip !== undefined ? configuration.ip : integration.config.ip,
        port: configuration.port !== undefined ? configuration.port : integration.config.port,
        username: configuration.username !== undefined ? configuration.username : integration.config.username,
        nodeName: configuration.nodeName !== undefined ? configuration.nodeName : integration.config.nodeName,
    };

    delete configuration.organizationId;
    delete configuration.ip;
    delete configuration.port;
    delete configuration.username;
    delete configuration.nodeName;
    delete configuration.folderId;

    await Integration.update({
        ...configuration,
        config: integrationConfig,
        status: configuration.online !== undefined ? (configuration.online ? 'online' : 'offline') : integration.status,
    }, { where: { id: integrationId } });

    return { success: true };
};

module.exports.getIntegrationCredentials = async (integrationId) => {
    const credential = await Credential.findOne({ where: { integrationId, type: 'password' } });
    return {
        password: credential ? credential.secret : null
    };
};

module.exports.getIntegrationUnsafe = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);

    if (!accessCheck.valid) return accessCheck.error;

    const credential = await Credential.findOne({ where: { integrationId, type: 'password' } });

    return {
        ...integration,
        ip: integration.config.ip,
        port: integration.config.port,
        username: integration.config.username,
        nodeName: integration.config.nodeName,
        password: credential ? credential.secret : null,
        online: integration.status === 'online',
    };
};

module.exports.getIntegration = async (accountId, integrationId) => {
    const integration = await this.getIntegrationUnsafe(accountId, integrationId);
    if (integration.code) return integration;
    
    return { ...integration, password: undefined };
};

module.exports.validateIntegrationAccess = validateIntegrationAccess;
