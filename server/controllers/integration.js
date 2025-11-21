const Integration = require("../models/Integration");
const Folder = require("../models/Folder");
const Credential = require("../models/Credential");
const Entry = require("../models/Entry");
const { hasOrganizationAccess, validateFolderAccess } = require("../utils/permission");
const { getAllResources } = require("./pve");

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
    };

    if (configuration.type === 'proxmox' || !configuration.type) {
        const { createTicket, getAllNodes } = require("./pve");
        try {
            const serverConfig = {
                ip: configuration.ip,
                port: configuration.port,
                username: configuration.username,
                password: configuration.password,
            };
            
            const ticket = await createTicket(
                { ip: serverConfig.ip, port: serverConfig.port },
                serverConfig.username,
                serverConfig.password
            );
            
            await getAllNodes({ ip: serverConfig.ip, port: serverConfig.port }, ticket);
        } catch (error) {
            console.error('Failed to connect to Proxmox cluster:', error.message);
            
            if (error.response?.status === 401 || error.message.includes('401')) {
                return { code: 401, message: "Invalid credentials for Proxmox server" };
            }
            
            if (error.code === 'ECONNREFUSED') {
                return { code: 503, message: `Cannot reach Proxmox server at ${configuration.ip}:${configuration.port}` };
            }
            
            if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                return { code: 503, message: `Proxmox server at ${configuration.ip}:${configuration.port} is not reachable` };
            }
            
            return { code: 500, message: `Failed to connect to Proxmox cluster: ${error.message}` };
        }
    }

    const integration = await Integration.create({
        organizationId: configuration.organizationId || null,
        type: configuration.type || 'proxmox',
        name: configuration.name,
        config: integrationConfig,
        status: 'online',
    });

    if (configuration.password) {
        await Credential.create({
            integrationId: integration.id,
            type: 'password',
            secret: configuration.password,
        });
    }

    if (integration.type === 'proxmox') {
        try {
            await this.syncIntegration(accountId, integration.id);
        } catch (error) {
            console.error('Error during integration sync on creation:', error.message);
        }
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
    };

    delete configuration.organizationId;
    delete configuration.ip;
    delete configuration.port;
    delete configuration.username;
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
        password: credential ? credential.secret : null,
        online: integration.status === 'online',
    };
};

module.exports.getIntegration = async (accountId, integrationId) => {
    const integration = await this.getIntegrationUnsafe(accountId, integrationId);
    if (integration.code) return integration;
    
    return { ...integration, password: undefined };
};

module.exports.syncIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);

    if (!accessCheck.valid) return accessCheck.error;

    if (integration.type !== 'proxmox') {
        return { code: 400, message: 'Only Proxmox integrations can be synced' };
    }

    const credential = await Credential.findOne({ where: { integrationId, type: 'password' } });
    if (!credential) {
        return { code: 400, message: 'Integration credentials not found' };
    }

    const serverConfig = {
        ip: integration.config.ip,
        port: integration.config.port,
        username: integration.config.username,
        password: credential.secret,
    };

    try {
        const { resources } = await getAllResources(serverConfig);

        const existingFolders = await Folder.findAll({
            where: { integrationId: integration.id }
        });

        const parentFolder = existingFolders.find(f => f.type === null);
        const parentFolderId = parentFolder ? parentFolder.parentId : null;

        await Folder.destroy({ where: { integrationId: integration.id } });
        await Entry.destroy({ where: { integrationId: integration.id } });

        let syncedNodes = 0;
        let totalResources = 0;

        for (const nodeData of resources) {
            const nodeName = nodeData.node;

            const folder = await Folder.create({
                organizationId: integration.organizationId || null,
                accountId: integration.organizationId ? null : accountId,
                parentId: parentFolderId,
                integrationId: integration.id,
                name: `${integration.name} - ${nodeName}`,
                position: 0,
                type: 'pve-node',
            });

            syncedNodes++;

            for (const resource of nodeData.resources) {
                let renderer = 'terminal';
                let icon = 'terminal';

                if (resource.type === 'pve-qemu') {
                    renderer = 'guac';
                    icon = 'server';
                } else if (resource.type === 'pve-lxc') {
                    renderer = 'terminal';
                    icon = 'linux';
                } else if (resource.type === 'pve-shell') {
                    renderer = 'terminal';
                    icon = 'terminal';
                }

                const resourceConfig = {
                    nodeName: nodeName,
                    vmid: resource.id,
                };

                await Entry.create({
                    accountId: integration.organizationId ? null : accountId,
                    organizationId: integration.organizationId || null,
                    folderId: folder.id,
                    integrationId: integration.id,
                    type: resource.type,
                    renderer: renderer,
                    name: resource.name,
                    icon: icon,
                    position: 0,
                    status: resource.status || null,
                    config: resourceConfig,
                });

                totalResources++;
            }
        }

        await Integration.update(
            { lastSyncAt: new Date(), status: 'online' },
            { where: { id: integrationId } }
        );

        return { 
            success: true, 
            message: `Integration synced successfully: ${syncedNodes} nodes, ${totalResources} resources` 
        };
    } catch (error) {
        console.error('Error syncing integration:', error);
        
        await Integration.update(
            { status: 'offline' },
            { where: { id: integrationId } }
        );

        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        return { code: 500, message: 'Failed to sync integration: ' + errorMessage };
    }
};

module.exports.validateIntegrationAccess = validateIntegrationAccess;
