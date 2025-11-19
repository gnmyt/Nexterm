const Identity = require("../models/Identity");
const Credential = require("../models/Credential");
const EntryIdentity = require("../models/EntryIdentity");
const { hasOrganizationAccess } = require("../utils/permission");
const OrganizationMember = require("../models/OrganizationMember");
const { Op } = require("sequelize");

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

const upsertCredential = async (identityId, type, secret) => {
    const existing = await Credential.findOne({ where: { identityId, type } });
    if (existing) {
        await Credential.update({ secret }, { where: { id: existing.id } });
    } else {
        await Credential.create({ identityId, type, secret });
    }
};

const syncCredentials = async (identityId, credentialType, password = null, sshKey = null, passphrase = null) => {
    if (credentialType === "password" && password) {
        await upsertCredential(identityId, "password", password);
        await Credential.destroy({ where: { identityId, type: { [Op.in]: ["sshKey", "passphrase"] } } });
    } else if (credentialType === "key" && sshKey) {
        await upsertCredential(identityId, "sshKey", sshKey);
        if (passphrase) {
            await upsertCredential(identityId, "passphrase", passphrase);
        } else {
            await Credential.destroy({ where: { identityId, type: "passphrase" } });
        }
        await Credential.destroy({ where: { identityId, type: "password" } });
    }
};

module.exports.getIdentityCredentials = async (identityId) => {
    const credentials = await Credential.findAll({ where: { identityId } });
    const result = {};
    for (const cred of credentials) {
        result[cred.type] = cred.secret;
    }
    return result;
}

module.exports.listIdentities = async (accountId) => {
    const personalIdentities = await Identity.findAll({ where: { accountId } });

    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });

    const organizationIds = memberships.map(m => m.organizationId);

    let organizationIdentities = [];
    if (organizationIds.length > 0) {
        organizationIdentities = await Identity.findAll({ where: { organizationId: { [Op.in]: organizationIds } } });
    }

    return [...personalIdentities, ...organizationIdentities].map(identity => ({
        ...identity,
        createdAt: undefined,
        updatedAt: undefined,
    }));
};

module.exports.createIdentity = async (accountId, configuration) => {
    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, configuration.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization" };
        }
    }

    const identity = await Identity.create({
        ...configuration,
        accountId: configuration.organizationId ? null : accountId,
        organizationId: configuration.organizationId || null,
        password: undefined,
        sshKey: undefined,
        passphrase: undefined,
    });

    await syncCredentials(identity.id, configuration.type, configuration.password, configuration.sshKey, configuration.passphrase);

    return identity;
};

module.exports.deleteIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const accessCheck = await validateIdentityAccess(accountId, identity);

    if (!accessCheck.valid) return accessCheck.error;

    const identityInfo = {
        id: identity.id,
        name: identity.name,
        type: identity.type,
        organizationId: identity.organizationId,
        accountId: identity.accountId,
    };

    await Credential.destroy({ where: { identityId } });
    await EntryIdentity.destroy({ where: { identityId } });

    if (identity.organizationId) {
        await Identity.destroy({ where: { id: identityId, organizationId: identity.organizationId } });
    } else {
        await Identity.destroy({ where: { id: identityId, accountId } });
    }

    return { success: true, identity: identityInfo };
};

module.exports.updateIdentity = async (accountId, identityId, configuration) => {
    const identity = await Identity.findByPk(identityId);
    const accessCheck = await validateIdentityAccess(accountId, identity);

    if (!accessCheck.valid) return accessCheck.error;

    const identityInfo = {
        id: identity.id,
        name: identity.name,
        type: identity.type,
        organizationId: identity.organizationId,
        accountId: identity.accountId,
    };

    delete configuration.accountId;
    delete configuration.organizationId;
    
    const password = configuration.password;
    const sshKey = configuration.sshKey;
    const passphrase = configuration.passphrase;
    
    delete configuration.password;
    delete configuration.sshKey;
    delete configuration.passphrase;

    if (identity.organizationId) {
        await Identity.update(configuration, {
            where: { id: identityId, organizationId: identity.organizationId },
        });
    } else {
        await Identity.update(configuration, { where: { id: identityId, accountId } });
    }

    await syncCredentials(identityId, configuration.type, password, sshKey, passphrase);

    return { success: true, identity: identityInfo };
};

module.exports.getIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const accessCheck = await validateIdentityAccess(accountId, identity);

    if (!accessCheck.valid) return accessCheck.error;

    return identity;
};