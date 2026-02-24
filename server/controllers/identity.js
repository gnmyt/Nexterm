const Identity = require("../models/Identity");
const Credential = require("../models/Credential");
const EntryIdentity = require("../models/EntryIdentity");
const { hasOrganizationAccess } = require("../utils/permission");
const OrganizationMember = require("../models/OrganizationMember");
const { Op } = require("sequelize");
const logger = require("../utils/logger");
const stateBroadcaster = require("../lib/StateBroadcaster");

const validateAccess = async (accountId, identity) => {
    if (!identity) return { valid: false, error: { code: 501, message: "Identity does not exist" } };
    if (identity.accountId && identity.accountId !== accountId) return { valid: false, error: { code: 403, message: "No permission to access this identity" } };
    if (identity.organizationId && !(await hasOrganizationAccess(accountId, identity.organizationId))) return { valid: false, error: { code: 403, message: "No access to this organization's identity" } };
    return { valid: true, identity };
};

const upsertCredential = async (identityId, type, secret) => {
    const existing = await Credential.findOne({ where: { identityId, type }, raw: false });
    existing ? (existing.secret = secret, await existing.save()) : await Credential.create({ identityId, type, secret });
};

const syncCredentials = async (identityId, type, password, sshKey, passphrase) => {
    if (type === "password" && password) {
        await upsertCredential(identityId, "password", password);
        await Credential.destroy({ where: { identityId, type: { [Op.in]: ["ssh-key", "passphrase"] } } });
    } else if (type === "password-only" && password) {
        await upsertCredential(identityId, "password", password);
        await Credential.destroy({ where: { identityId, type: { [Op.in]: ["ssh-key", "passphrase"] } } });
    } else if (type === "both") {
        if (password) await upsertCredential(identityId, "password", password);
        if (sshKey) {
            await upsertCredential(identityId, "ssh-key", sshKey);
            passphrase ? await upsertCredential(identityId, "passphrase", passphrase) : await Credential.destroy({ where: { identityId, type: "passphrase" } });
        }
    } else if (type === "ssh" && sshKey) {
        await upsertCredential(identityId, "ssh-key", sshKey);
        passphrase ? await upsertCredential(identityId, "passphrase", passphrase) : await Credential.destroy({ where: { identityId, type: "passphrase" } });
        await Credential.destroy({ where: { identityId, type: "password" } });
    }
};

module.exports.getIdentityCredentials = async (identityId) => {
    const creds = await Credential.findAll({ where: { identityId } });
    return creds.reduce((acc, c) => ({ ...acc, [c.type]: c.secret }), {});
};

module.exports.listIdentities = async (accountId) => {
    const personal = await Identity.findAll({ where: { accountId, organizationId: null } });
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    const orgIds = memberships.map(m => m.organizationId);
    const org = orgIds.length ? await Identity.findAll({ where: { organizationId: { [Op.in]: orgIds } } }) : [];
    
    const format = (i, scope) => ({ id: i.id, name: i.name, type: i.type, username: i.username, organizationId: i.organizationId, accountId: i.accountId, scope });
    return [...personal.map(i => format(i, 'personal')), ...org.map(i => format(i, 'organization'))];
};

module.exports.createIdentity = async (accountId, config) => {
    if (config.organizationId && !(await hasOrganizationAccess(accountId, config.organizationId))) {
        return { code: 403, message: "No access to this organization" };
    }

    // Validation block
    if (!config.name || !config.name.trim()) {
        return { code: 400, message: "settings.identities.dialog.messages.nameRequired" };
    }
    if (
        (config.type === "password" ||
            config.type === "password-only" ||
            config.type === "both") &&
        (!config.password || !config.password.trim())
    ) {
        return { code: 400, message: "settings.identities.dialog.messages.passwordRequired" };
    }
    if (
        (config.type === "ssh" || config.type === "both") &&
        (!config.sshKey || typeof config.sshKey !== "string" || !config.sshKey.trim())
    ) {
        return { code: 400, message: "settings.identities.dialog.messages.sshKeyRequired" };
    }

    const identity = await Identity.create({
        ...config, accountId: config.organizationId ? null : accountId, organizationId: config.organizationId || null,
        password: undefined, sshKey: undefined, passphrase: undefined,
    });
    await syncCredentials(identity.id, config.type, config.password, config.sshKey, config.passphrase);
    logger.info("Identity created", { identityId: identity.id, name: identity.name, scope: config.organizationId ? 'organization' : 'personal' });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: config.organizationId });

    return identity;
};

module.exports.deleteIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const check = await validateAccess(accountId, identity);
    if (!check.valid) return check.error;

    await Credential.destroy({ where: { identityId } });
    await EntryIdentity.destroy({ where: { identityId } });
    await Identity.destroy({ where: { id: identityId, ...(identity.organizationId ? { organizationId: identity.organizationId } : { accountId }) } });
    logger.info("Identity deleted", { identityId, name: identity.name });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: identity.organizationId });

    return { success: true, identity: { id: identity.id, name: identity.name, type: identity.type, organizationId: identity.organizationId, accountId: identity.accountId } };
};

module.exports.updateIdentity = async (accountId, identityId, config) => {
    const identity = await Identity.findByPk(identityId);
    const check = await validateAccess(accountId, identity);
    if (!check.valid) return check.error;

    const { password, sshKey, passphrase, accountId: _, organizationId: __, ...updateConfig } = config;
    await Identity.update(updateConfig, { where: { id: identityId, ...(identity.organizationId ? { organizationId: identity.organizationId } : { accountId }) } });

    const effectiveType = config.type || identity.type;
    await syncCredentials(identityId, effectiveType, password, sshKey, passphrase);
    logger.info("Identity updated", { identityId, name: identity.name });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: identity.organizationId });

    return { success: true, identity: { id: identity.id, name: identity.name, type: identity.type, organizationId: identity.organizationId, accountId: identity.accountId } };
};

module.exports.moveIdentityToOrganization = async (accountId, identityId, organizationId) => {
    const identity = await Identity.findByPk(identityId);
    if (!identity) return { code: 501, message: "Identity does not exist" };
    if (identity.accountId !== accountId) return { code: 403, message: "Can only move your own personal identities" };
    if (!(await hasOrganizationAccess(accountId, organizationId))) return { code: 403, message: "No access to this organization" };

    await Identity.update({ accountId: null, organizationId }, { where: { id: identityId } });
    logger.info("Identity moved to organization", { identityId, name: identity.name, organizationId });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId });

    return { success: true, identity: { id: identity.id, name: identity.name, type: identity.type, organizationId, accountId: null } };
};

module.exports.getIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const check = await validateAccess(accountId, identity);
    return check.valid ? identity : check.error;
};
