const Server = require("../models/Server");
const PVEServer = require("../models/PVEServer");
const Identity = require("../models/Identity");
const { listFolders } = require("./folder");
const { hasOrganizationAccess, validateFolderAccess } = require("../utils/permission");
const { Op } = require("sequelize");
const OrganizationMember = require("../models/OrganizationMember");
const { listIdentities } = require("./identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");

const validateServerAccess = async (accountId, server, errorMessage = "You don't have permission to access this server") => {
    if (!server) return { code: 401, message: "Server does not exist" };

    if (server.accountId && server.accountId !== accountId) {
        return { code: 403, message: errorMessage };
    } else if (server.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, server.organizationId);
        if (!hasAccess) {
            return { code: 403, message: `You don't have access to this organization's server` };
        }
    }
    return { valid: true, server };
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

module.exports.createServer = async (accountId, configuration) => {
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

    const server = await Server.create({
        ...configuration,
        accountId: folder?.folder?.organizationId ? null : accountId,
        organizationId: folder?.folder?.organizationId || null,
    });

    await createAuditLog({
        action: AUDIT_ACTIONS.SERVER_CREATE,
        accountId,
        organizationId: folder?.folder?.organizationId || null,
        resource: RESOURCE_TYPES.SERVER,
        resourceId: server.id,
        details: {
            name: server.name,
            folderId: server.folderId,
            identities: server.identities,
            protocol: server.protocol,
            ip: server.ip,
        }
    });

    return server;
};

module.exports.deleteServer = async (accountId, serverId) => {
    const server = await Server.findByPk(serverId);
    const accessCheck = await validateServerAccess(accountId, server, "You don't have permission to delete this server");

    if (!accessCheck.valid) return accessCheck;

    if (server.identities && server.identities.length > 0) {
        await Identity.destroy({ where: { id: server.identities } });
    }

    await Server.destroy({ where: { id: serverId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.SERVER_DELETE,
        accountId,
        organizationId: server.organizationId,
        resource: RESOURCE_TYPES.SERVER,
        resourceId: serverId,
        details: { name: server.name, folderId: server.folderId }
    });

    return { success: true };
};

module.exports.editServer = async (accountId, serverId, configuration) => {
    const server = await Server.findByPk(serverId);
    const accessCheck = await validateServerAccess(accountId, server, "You don't have permission to edit this server");

    if (!accessCheck.valid) return accessCheck;

    if (configuration.folderId) {
        const folderCheck = await validateFolderAccess(accountId, configuration.folderId);
        if (!folderCheck.valid) return folderCheck.error;
    }

    if (configuration.identities && configuration.identities.length > 0) {
        const validationResult = await validateIdentities(accountId, configuration.identities, server.organizationId);

        if (!validationResult.valid) return validationResult.error;
    }

    delete configuration.accountId;
    delete configuration.organizationId;

    await Server.update(configuration, { where: { id: serverId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.SERVER_UPDATE,
        accountId,
        organizationId: server.organizationId,
        resource: RESOURCE_TYPES.SERVER,
        resourceId: serverId,
        details: configuration
    });

    return { success: true };
};

module.exports.getServer = async (accountId, serverId) => {
    const server = await Server.findByPk(serverId);
    const accessCheck = await validateServerAccess(accountId, server);

    if (!accessCheck.valid) return accessCheck;

    return {
        ...server,
        identities: Array.isArray(server.identities) ? server.identities : JSON.parse(server.identities || "[]"),
    };
};

module.exports.listServers = async (accountId) => {
    const folders = await listFolders(accountId, true);

    const personalServers = await Server.findAll({
        where: { accountId },
        order: [["folderId", "ASC"], ["position", "ASC"]],
    });

    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });

    const organizationIds = memberships.map(m => m.organizationId);

    let organizationServers = [];
    if (organizationIds.length > 0) {
        organizationServers = await Server.findAll({
            where: {
                organizationId: { [Op.in]: organizationIds },
            },
            order: [["folderId", "ASC"], ["position", "ASC"]],
        });
    }

    const servers = [...personalServers, ...organizationServers];

    const folderMap = new Map();
    const flattenFolders = (folders) => {
        folders.forEach(folder => {
            folderMap.set(folder.id, folder);
            if (folder.entries && folder.entries.length > 0) flattenFolders(folder.entries);
        });
    };

    flattenFolders(folders);

    servers.forEach(server => {
        const folder = folderMap.get(server.folderId);
        if (folder) {
            folder.entries.push({
                type: "server", id: server.id, icon: server.icon, name: server.name,
                position: server.position, identities: JSON.parse(server.identities || "[]"), protocol: server.protocol,
                ip: server.ip,
            });
        }
    });

    const personalPveServers = await PVEServer.findAll({
        where: { accountId },
    });

    let organizationPveServers = [];
    if (organizationIds.length > 0) {
        organizationPveServers = await PVEServer.findAll({ where: { organizationId: { [Op.in]: organizationIds } } });
    }

    const pveServers = [...personalPveServers, ...organizationPveServers];

    pveServers.forEach(server => {
        const folder = folderMap.get(server.folderId);
        if (folder) {
            folder.entries.push({
                type: "pve-server", id: server.id, name: server.name, online: server.online === 1,
                entries: JSON.parse(server.resources || "[]"), ip: server.ip,
            });
        }
    });

    return folders;
};

module.exports.duplicateServer = async (accountId, serverId) => {
    const server = await Server.findByPk(serverId);
    if (!server) return { code: 404, message: "Server not found" };

    const accessCheck = await validateServerAccess(accountId, server);

    if (!accessCheck.valid) return accessCheck;

    await createAuditLog({
        action: AUDIT_ACTIONS.SERVER_CREATE,
        accountId,
        organizationId: server.organizationId,
        resource: RESOURCE_TYPES.SERVER,
        resourceId: serverId,
        details: { name: server.name, folderId: server.folderId }
    });

    return await Server.create({
        ...server,
        id: undefined,
        name: server.name + " (Copy)",
        identities: Array.isArray(server.identities) ? server.identities : JSON.parse(server.identities || "[]"),
        config: server.config ? JSON.parse(server.config) : {},
    });
};

module.exports.validateServerAccess = validateServerAccess;