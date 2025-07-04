const Identity = require("../models/Identity");
const Server = require("../models/Server");
const { encrypt } = require("../utils/encryption");
const { hasOrganizationAccess } = require("../utils/permission");
const OrganizationMember = require("../models/OrganizationMember");
const { Op } = require("sequelize");

module.exports.mapIdentitySecure = (identity) => {
    return {
        id: identity.id,
        name: identity.name,
        username: identity.username,
        type: identity.type,
        organizationId: identity.organizationId,
    };
};

const encryptIdentity = (identity) => {
    if (identity.password && identity.password !== "********") {
        const encrypted = encrypt(identity.password);
        identity.password = encrypted.encrypted;
        identity.passwordIV = encrypted.iv;
        identity.passwordAuthTag = encrypted.authTag;
    }
    if (identity.sshKey) {
        const encrypted = encrypt(identity.sshKey);
        identity.sshKey = encrypted.encrypted;
        identity.sshKeyIV = encrypted.iv;
        identity.sshKeyAuthTag = encrypted.authTag;
    }
    if (identity.passphrase && identity.passphrase !== "********") {
        const encrypted = encrypt(identity.passphrase);
        identity.passphrase = encrypted.encrypted;
        identity.passphraseIV = encrypted.iv;
        identity.passphraseAuthTag = encrypted.authTag;
    }

    return identity;
};

const validateIdentityAccess = async (accountId, identity) => {
    if (!identity) return { valid: false, error: { code: 501, message: "The identity does not exist" } };

    if (identity.accountId && identity.accountId !== accountId) {
        return { valid: false, error: { code: 403, message: "You don't have permission to access this identity" } };
    } else if (identity.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, identity.organizationId);
        if (!hasAccess) {
            return {
                valid: false,
                error: { code: 403, message: "You don't have access to this organization's identity" },
            };
        }
    }
    return { valid: true, identity };
};

module.exports.listIdentities = async (accountId) => {
    const personalIdentities = await Identity.findAll({ where: { accountId } });

    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });

    const organizationIds = memberships.map(m => m.organizationId);

    let organizationIdentities = [];
    if (organizationIds.length > 0) {
        organizationIdentities = await Identity.findAll({ where: { organizationId: { [Op.in]: organizationIds } } });
    }

    const allIdentities = [...personalIdentities, ...organizationIdentities];
    return allIdentities.map(this.mapIdentitySecure);
};

module.exports.createIdentity = async (accountId, configuration) => {
    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, configuration.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
        return await Identity.create({
            ...encryptIdentity(configuration),
            accountId: null,
            organizationId: configuration.organizationId,
        });
    }

    return await Identity.create({ ...encryptIdentity(configuration), accountId, organizationId: null });
};

module.exports.deleteIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const accessCheck = await validateIdentityAccess(accountId, identity);

    if (!accessCheck.valid) return accessCheck.error;

    let serverQuery;
    if (identity.organizationId) {
        serverQuery = { organizationId: identity.organizationId };
    } else {
        serverQuery = { accountId };
    }

    const servers = await Server.findAll({ where: serverQuery });

    for (const server of servers) {
        let serverIdentities = [];

        if (typeof server.identities === "string") {
            try {
                serverIdentities = JSON.parse(server.identities);
            } catch (e) {
                serverIdentities = [];
            }
        } else if (Array.isArray(server.identities)) {
            serverIdentities = server.identities;
        }

        const identityIdNum = parseInt(identityId);
        const updatedIdentities = serverIdentities.filter(id => {
            const serverId = parseInt(id);
            return serverId !== identityIdNum;
        });
        
        if (updatedIdentities.length !== serverIdentities.length) {
            await Server.update({ identities: updatedIdentities }, { where: { id: server.id } });
        }
    }

    if (identity.organizationId) {
        await Identity.destroy({ where: { id: identityId, organizationId: identity.organizationId } });
    } else {
        await Identity.destroy({ where: { id: identityId, accountId } });
    }

    return { success: true };
};

module.exports.updateIdentity = async (accountId, identityId, configuration) => {
    const identity = await Identity.findByPk(identityId);
    const accessCheck = await validateIdentityAccess(accountId, identity);

    if (!accessCheck.valid) return accessCheck.error;

    delete configuration.accountId;
    delete configuration.organizationId;

    if (identity.organizationId) {
        await Identity.update(encryptIdentity(configuration), {
            where: { id: identityId, organizationId: identity.organizationId },
        });
    } else {
        await Identity.update(encryptIdentity(configuration), { where: { id: identityId, accountId } });
    }

    return { success: true };
};

module.exports.getIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const accessCheck = await validateIdentityAccess(accountId, identity);

    if (!accessCheck.valid) return accessCheck.error;

    return identity;
};