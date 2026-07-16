const Integration = require("../models/Integration");
const logger = require("../utils/logger");
const Folder = require("../models/Folder");
const Credential = require("../models/Credential");
const Entry = require("../models/Entry");
const { hasOrganizationAccess, hasOrganizationPermission, hasAccountPermission, validateFolderAccess } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { getProvider, entryKey } = require("../lib/hypervisors");

const validateIntegrationAccess = async (accountId, integration, requiredPermission = null) => {
    if (!integration) return { valid: false, error: { code: 401, message: "Integration does not exist" } };

    if (integration.organizationId) {
        const allowed = requiredPermission
            ? await hasOrganizationPermission(accountId, integration.organizationId, requiredPermission)
            : await hasOrganizationAccess(accountId, integration.organizationId);
        if (!allowed) {
            return {
                valid: false,
                error: { code: 403, message: `You don't have access to this organization's integration` },
            };
        }
    } else if (requiredPermission && !(await hasAccountPermission(accountId, requiredPermission))) {
        return { valid: false, error: { code: 403, message: "You don't have permission to manage resources" } };
    }
    return { valid: true, integration };
};

const buildProviderConfig = (integration, credential) => ({
    ip: integration.config.ip,
    port: integration.config.port,
    username: integration.config.username,
    password: credential ? credential.secret : null,
});

const mapConnectionError = (error, ip, port) => {
    if (error.response?.status === 401 || error.message.includes("401"))
        return { code: 401, message: "Invalid credentials for the integration host" };
    if (error.code === "ECONNREFUSED")
        return { code: 503, message: `Cannot reach integration host at ${ip}:${port}` };
    if (error.code === "ETIMEDOUT" || error.code === "ENOTFOUND")
        return { code: 503, message: `Integration host at ${ip}:${port} is not reachable` };
    return { code: 500, message: `Failed to connect to integration host: ${error.message}` };
};

const ensureRootFolder = async (integration, ownerAccountId = null) => {
    let root = await Folder.findOne({ where: { integrationId: integration.id, type: "integration-root" } });
    if (root) return root;

    const siblings = await Folder.findAll({ where: { integrationId: integration.id } });
    const sample = siblings[0] || null;

    const accountId = integration.organizationId
        ? null
        : ownerAccountId ?? (sample ? sample.accountId : null);

    if (!integration.organizationId && !accountId) {
        throw new Error("Cannot determine an owner for the integration root folder");
    }

    return Folder.create({
        accountId,
        organizationId: integration.organizationId || (sample ? sample.organizationId : null),
        parentId: sample ? sample.parentId : null,
        integrationId: integration.id,
        name: integration.name,
        position: sample ? sample.position : 0,
        type: "integration-root",
        config: { role: "integration-root" },
    });
};

const reconcileIntegration = async (integration, ownerAccountId = null) => {
    const provider = getProvider(integration.type);
    if (!provider) throw new Error(`No provider registered for integration type '${integration.type}'`);

    const credential = await Credential.findOne({ where: { integrationId: integration.id, type: "password" } });
    if (!credential) throw new Error("Integration credentials not found");

    const nodes = await provider.discover(buildProviderConfig(integration, credential));

    const rootFolder = await ensureRootFolder(integration, ownerAccountId);
    const ownership = { accountId: rootFolder.accountId, organizationId: rootFolder.organizationId };

    const nodeFolders = await Folder.findAll({ where: { integrationId: integration.id, type: "integration-node" } });
    const folderByKey = new Map(nodeFolders.map((folder) => [folder.config?.nodeKey, folder]));

    const existingEntries = await Entry.findAll({ where: { integrationId: integration.id } });
    const entriesByKey = new Map(existingEntries.map((entry) => [entryKey(entry), entry]));

    const maxPosByFolder = new Map();
    for (const entry of existingEntries) {
        maxPosByFolder.set(entry.folderId, Math.max(maxPosByFolder.get(entry.folderId) ?? -1, entry.position));
    }

    const seenFolderIds = new Set();
    const seenEntryIds = new Set();
    const unreachableFolderIds = new Set();

    let maxFolderPosition = nodeFolders.reduce((max, folder) => Math.max(max, folder.position), -1);
    let added = 0;
    let updated = 0;

    for (const node of nodes) {
        let folder = folderByKey.get(node.key);
        if (!folder) {
            folder = await Folder.create({
                ...ownership,
                parentId: rootFolder.id,
                integrationId: integration.id,
                name: node.name,
                position: ++maxFolderPosition,
                type: "integration-node",
                config: { nodeKey: node.key },
            });
        }
        seenFolderIds.add(folder.id);

        if (node.reachable === false) {
            unreachableFolderIds.add(folder.id);
            continue;
        }

        let maxEntryPosition = maxPosByFolder.get(folder.id) ?? -1;

        for (const resource of node.resources) {
            const key = `${node.key}::${resource.providerId}`;
            const existing = entriesByKey.get(key);

            if (existing) {
                seenEntryIds.add(existing.id);

                const changes = {};
                if (existing.folderId !== folder.id) changes.folderId = folder.id;
                if (existing.name !== resource.name) changes.name = resource.name;
                if (existing.renderer !== resource.renderer) changes.renderer = resource.renderer;
                if (existing.icon !== resource.icon) changes.icon = resource.icon;
                if (resource.status && existing.status !== resource.status) changes.status = resource.status;
                const mergedConfig = { ...existing.config, ...resource.config };
                if (JSON.stringify(existing.config) !== JSON.stringify(mergedConfig)) changes.config = mergedConfig;

                if (Object.keys(changes).length > 0) {
                    await Entry.update(changes, { where: { id: existing.id } });
                    updated++;
                }
            } else {
                await Entry.create({
                    ...ownership,
                    folderId: folder.id,
                    integrationId: integration.id,
                    type: resource.type,
                    renderer: resource.renderer,
                    name: resource.name,
                    icon: resource.icon,
                    position: ++maxEntryPosition,
                    status: resource.status || null,
                    config: resource.config,
                });
                added++;
            }
        }
    }

    const staleEntries = existingEntries.filter(
        (entry) => !seenEntryIds.has(entry.id) && !unreachableFolderIds.has(entry.folderId),
    );
    if (staleEntries.length > 0) {
        await Entry.destroy({ where: { id: staleEntries.map((entry) => entry.id) } });
    }

    const staleFolders = nodeFolders.filter((folder) => !seenFolderIds.has(folder.id));
    if (staleFolders.length > 0) {
        await Folder.destroy({ where: { id: staleFolders.map((folder) => folder.id) } });
    }

    await Integration.update(
        { lastSyncAt: new Date(), status: "online" },
        { where: { id: integration.id } },
    );

    return {
        nodes: nodes.length,
        added,
        updated,
        removedEntries: staleEntries.length,
        removedFolders: staleFolders.length,
    };
};

module.exports.createIntegration = async (accountId, configuration) => {
    if (configuration.organizationId) {
        if (!(await hasOrganizationPermission(accountId, configuration.organizationId, Permission.RESOURCES_MANAGE)))
            return { code: 403, message: "You don't have permission to manage resources in this organization" };
    } else if (!(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources" };
    }

    const type = configuration.type || "proxmox";
    const provider = getProvider(type);
    if (!provider) return { code: 400, message: `Unsupported integration type: ${type}` };

    let parentFolderId = null;
    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) return folderCheck.error;

        parentFolderId = folderCheck.folder.id;
        if (folderCheck.folder.organizationId && !configuration.organizationId) {
            configuration.organizationId = folderCheck.folder.organizationId;
        }
    }

    try {
        await provider.testConnection({
            ip: configuration.ip,
            port: configuration.port,
            username: configuration.username,
            password: configuration.password,
        });
    } catch (error) {
        logger.error("Failed to connect to integration host", { ip: configuration.ip, port: configuration.port, error: error.message });
        return mapConnectionError(error, configuration.ip, configuration.port);
    }

    const integration = await Integration.create({
        organizationId: configuration.organizationId || null,
        type,
        name: configuration.name,
        config: {
            ip: configuration.ip,
            port: configuration.port,
            username: configuration.username,
            monitoringEnabled: configuration.monitoringEnabled || false,
        },
        status: "online",
    });

    logger.info(`Integration created`, { integrationId: integration.id, name: integration.name, type: integration.type });

    if (configuration.password) {
        await Credential.create({ integrationId: integration.id, type: "password", secret: configuration.password });
    }

    await Folder.create({
        accountId: configuration.organizationId ? null : accountId,
        organizationId: configuration.organizationId || null,
        parentId: parentFolderId,
        integrationId: integration.id,
        name: integration.name,
        position: 0,
        type: "integration-root",
        config: { role: "integration-root" },
    });

    try {
        await reconcileIntegration(integration, accountId);
    } catch (error) {
        logger.error("Error during integration sync on creation", { integrationId: integration.id, error: error.message });
        await Integration.update({ status: "offline" }, { where: { id: integration.id } });
    }

    return integration;
};

module.exports.deleteIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, Permission.RESOURCES_MANAGE);

    if (!accessCheck.valid) return accessCheck.error;

    await Entry.destroy({ where: { integrationId } });
    await Folder.destroy({ where: { integrationId } });
    await Integration.destroy({ where: { id: integrationId } });

    logger.info(`Integration deleted`, { integrationId, name: integration.name });

    return { success: true };
};

module.exports.editIntegration = async (accountId, integrationId, configuration) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, Permission.RESOURCES_MANAGE);

    if (!accessCheck.valid) return accessCheck.error;

    const rootFolder = await Folder.findOne({ where: { integrationId, type: "integration-root" } });

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) return folderCheck.error;

        if (integration.organizationId && folderCheck.folder.organizationId !== integration.organizationId) {
            return { code: 403, message: "Folder must belong to the same organization as the integration" };
        } else if (!integration.organizationId && folderCheck.folder.organizationId) {
            return { code: 403, message: "Cannot move a personal integration to an organization folder" };
        }

        if (rootFolder) {
            await Folder.update({ parentId: folderCheck.folder.id }, { where: { id: rootFolder.id } });
        }
    }

    if (configuration.name && rootFolder) {
        await Folder.update({ name: configuration.name }, { where: { id: rootFolder.id } });
    }

    if (configuration.password) {
        await Credential.destroy({ where: { integrationId, type: "password" } });
        await Credential.create({ integrationId, type: "password", secret: configuration.password });
        delete configuration.password;
    }

    const integrationConfig = {
        ...integration.config,
        ip: configuration.ip !== undefined ? configuration.ip : integration.config.ip,
        port: configuration.port !== undefined ? configuration.port : integration.config.port,
        username: configuration.username !== undefined ? configuration.username : integration.config.username,
        monitoringEnabled: configuration.monitoringEnabled !== undefined ? configuration.monitoringEnabled : integration.config.monitoringEnabled,
    };

    delete configuration.organizationId;
    delete configuration.ip;
    delete configuration.port;
    delete configuration.username;
    delete configuration.folderId;
    delete configuration.monitoringEnabled;

    await Integration.update({
        ...configuration,
        config: integrationConfig,
        status: configuration.online !== undefined ? (configuration.online ? "online" : "offline") : integration.status,
    }, { where: { id: integrationId } });

    logger.info(`Integration updated`, { integrationId, name: integration.name });

    return { success: true };
};

module.exports.getIntegrationCredentials = async (integrationId) => {
    const credential = await Credential.findOne({ where: { integrationId, type: "password" } });
    return { password: credential ? credential.secret : null };
};

module.exports.getIntegrationUnsafe = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);

    if (!accessCheck.valid) return accessCheck.error;

    const credential = await Credential.findOne({ where: { integrationId, type: "password" } });

    return {
        ...integration,
        ip: integration.config.ip,
        port: integration.config.port,
        username: integration.config.username,
        monitoringEnabled: integration.config.monitoringEnabled || false,
        password: credential ? credential.secret : null,
        online: integration.status === "online",
    };
};

module.exports.getIntegration = async (accountId, integrationId) => {
    const integration = await this.getIntegrationUnsafe(accountId, integrationId);
    if (integration.code) return integration;

    return { ...integration, password: undefined };
};

module.exports.syncIntegration = async (accountId, integrationId) => {
    const integration = await Integration.findByPk(integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration, Permission.RESOURCES_MANAGE);

    if (!accessCheck.valid) return accessCheck.error;

    if (!getProvider(integration.type)) {
        return { code: 400, message: `Integration type '${integration.type}' cannot be synced` };
    }

    try {
        logger.info(`Starting integration sync`, { integrationId, name: integration.name });
        const result = await reconcileIntegration(integration, accountId);
        logger.info(`Integration synced successfully`, { integrationId, ...result });

        return {
            success: true,
            message: `Integration synced: ${result.nodes} nodes, +${result.added} new, -${result.removedEntries} removed`,
            ...result,
        };
    } catch (error) {
        logger.error("Error syncing integration", { integrationId, error: error.message, stack: error.stack });
        await Integration.update({ status: "offline" }, { where: { id: integrationId } });

        const errorMessage = error.response?.data?.message || error.message || "Unknown error";
        return { code: 500, message: "Failed to sync integration: " + errorMessage };
    }
};

module.exports.performEntryAction = async (accountId, entryId, action) => {
    const entry = await Entry.findByPk(entryId);
    if (!entry) return { code: 404, message: "Entry not found" };
    if (!entry.integrationId) return { code: 400, message: "Entry is not linked to an integration" };

    const integration = await Integration.findByPk(entry.integrationId);
    const accessCheck = await validateIntegrationAccess(accountId, integration);
    if (!accessCheck.valid) return accessCheck.error;

    const provider = getProvider(integration.type);
    if (!provider || !provider.supportsPower || !provider.supportsPower(entry)) {
        return { code: 400, message: "This resource does not support power actions" };
    }

    const credential = await Credential.findOne({ where: { integrationId: integration.id, type: "password" } });
    if (!credential) return { code: 400, message: "Integration credentials not found" };

    try {
        await provider.setPower(buildProviderConfig(integration, credential), entry, action);
        return { success: true };
    } catch (error) {
        logger.error("Failed to perform power action", { entryId, action, error: error.message });
        return { code: 500, message: `Failed to ${action} resource` };
    }
};

module.exports.reconcileIntegration = reconcileIntegration;
module.exports.validateIntegrationAccess = validateIntegrationAccess;
