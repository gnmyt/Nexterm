const Identity = require("../models/Identity");
const Credential = require("../models/Credential");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Folder = require("../models/Folder");
const FolderIdentityProfile = require("../models/FolderIdentityProfile");
const sequelize = require("../utils/database");
const { hasOrganizationAccess, hasOrganizationPermission, hasAccountPermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
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

const validateManageAccess = async (accountId, identity) => {
    if (!identity) return { valid: false, error: { code: 501, message: "Identity does not exist" } };
    if (identity.organizationId) {
        if (!(await hasOrganizationPermission(accountId, identity.organizationId, Permission.IDENTITIES_MANAGE)))
            return { valid: false, error: { code: 403, message: "You don't have permission to manage this organization's identities" } };
        return { valid: true, identity };
    }
    if (identity.accountId !== accountId) return { valid: false, error: { code: 403, message: "No permission to access this identity" } };
    if (!(await hasAccountPermission(accountId, Permission.IDENTITIES_MANAGE)))
        return { valid: false, error: { code: 403, message: "You don't have permission to manage identities" } };
    return { valid: true, identity };
};

const upsertCredential = async (identityId, type, secret, transaction = null) => {
    const existing = await Credential.findOne({ where: { identityId, type }, raw: false, transaction });
    if (existing) {
        existing.secret = secret;
        await existing.save({ transaction });
    } else {
        await Credential.create({ identityId, type, secret }, { transaction });
    }
};

const syncCredentials = async (identityId, type, password, sshKey, passphrase, transaction = null) => {
    if (type === "password" || type === "password-only") {
        if (password) await upsertCredential(identityId, "password", password, transaction);
        await Credential.destroy({ where: { identityId, type: { [Op.in]: ["ssh-key", "passphrase"] } }, transaction });
        return;
    }

    if (type === "both") {
        if (password) await upsertCredential(identityId, "password", password, transaction);
    } else if (type === "ssh") {
        await Credential.destroy({ where: { identityId, type: "password" }, transaction });
    }

    if (sshKey) await upsertCredential(identityId, "ssh-key", sshKey, transaction);
    // A replacement key without a passphrase must not keep the old key's passphrase
    if (passphrase !== undefined || sshKey) {
        if (passphrase) await upsertCredential(identityId, "passphrase", passphrase, transaction);
        else await Credential.destroy({ where: { identityId, type: "passphrase" }, transaction });
    }
};

module.exports.syncCredentials = syncCredentials;

module.exports.getIdentityCredentials = async (identityId) => {
    const creds = await Credential.findAll({ where: { identityId } });
    return creds.reduce((acc, c) => ({ ...acc, [c.type]: c.secret }), {});
};

module.exports.listIdentities = async (accountId, { transaction = null } = {}) => {
    const personal = await Identity.findAll({ where: { accountId, organizationId: null }, transaction });
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" }, transaction });
    const orgIds = memberships.map(m => m.organizationId);
    const org = orgIds.length ? await Identity.findAll({ where: { organizationId: { [Op.in]: orgIds } }, transaction }) : [];
    
    const format = (i, scope) => ({ id: i.id, name: i.name, type: i.type, username: i.username, organizationId: i.organizationId, accountId: i.accountId, scope });
    return [...personal.map(i => format(i, 'personal')), ...org.map(i => format(i, 'organization'))];
};

const createIdentityData = async (accountId, config, transaction = null) => {
    if (config.organizationId) {
        if (!(await hasOrganizationPermission(accountId, config.organizationId, Permission.IDENTITIES_MANAGE)))
            return { code: 403, message: "You don't have permission to manage this organization's identities" };
    } else if (!(await hasAccountPermission(accountId, Permission.IDENTITIES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage identities" };
    }
    const identity = await Identity.create({
        ...config, accountId: config.organizationId ? null : accountId, organizationId: config.organizationId || null,
        password: undefined, sshKey: undefined, passphrase: undefined,
    }, { transaction });
    await syncCredentials(identity.id, config.type, config.password, config.sshKey, config.passphrase, transaction);
    return identity;
};

module.exports.createIdentityInTransaction = createIdentityData;

module.exports.createIdentity = async (accountId, config) => {
    const identity = await createIdentityData(accountId, config);
    if (identity.code) return identity;

    logger.info("Identity created", { identityId: identity.id, name: identity.name, scope: config.organizationId ? 'organization' : 'personal' });
    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: config.organizationId });
    return identity;
};

module.exports.deleteIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const check = await validateManageAccess(accountId, identity);
    if (!check.valid) return check.error;

    await Credential.destroy({ where: { identityId } });
    await EntryIdentity.destroy({ where: { identityId } });
    await Identity.destroy({ where: { id: identityId, ...(identity.organizationId ? { organizationId: identity.organizationId } : { accountId }) } });
    logger.info("Identity deleted", { identityId, name: identity.name });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: identity.organizationId });

    return { success: true, identity: { id: identity.id, name: identity.name, type: identity.type, organizationId: identity.organizationId, accountId: identity.accountId } };
};

const updateIdentityData = async (accountId, identityId, config, transaction = null) => {
    const identity = await Identity.findByPk(identityId, { transaction });
    const check = await validateManageAccess(accountId, identity);
    if (!check.valid) return check.error;

    const { password, sshKey, passphrase, accountId: _, organizationId: __, ...updateConfig } = config;
    await Identity.update(updateConfig, {
        where: { id: identityId, ...(identity.organizationId ? { organizationId: identity.organizationId } : { accountId }) },
        transaction,
    });

    const effectiveType = config.type || identity.type;
    await syncCredentials(identityId, effectiveType, password, sshKey, passphrase, transaction);
    return { success: true, identity };
};

module.exports.updateIdentityInTransaction = updateIdentityData;

module.exports.updateIdentity = async (accountId, identityId, config) => {
    const result = await updateIdentityData(accountId, identityId, config);
    if (result.code) return result;

    const identity = result.identity;
    logger.info("Identity updated", { identityId, name: config.name || identity.name });
    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: identity.organizationId });

    return { success: true, identity: {
        id: identity.id,
        name: config.name || identity.name,
        type: config.type || identity.type,
        organizationId: identity.organizationId,
        accountId: identity.accountId,
    } };
};

module.exports.moveIdentityToOrganization = async (accountId, identityId, organizationId) => {
    const identity = await Identity.findByPk(identityId);
    if (!identity) return { code: 501, message: "Identity does not exist" };
    if (identity.accountId !== accountId) return { code: 403, message: "Can only move your own personal identities" };
    if (!(await hasOrganizationPermission(accountId, organizationId, Permission.IDENTITIES_MANAGE))) return { code: 403, message: "You don't have permission to manage this organization's identities" };

    await sequelize.transaction(async (transaction) => {
        const profileRows = await FolderIdentityProfile.findAll({
            where: { identityId, accountId },
            transaction,
        });
        const folderIds = [...new Set(profileRows.map((row) => row.folderId))];
        const organizationFolders = folderIds.length ? await Folder.findAll({
            where: { id: { [Op.in]: folderIds }, organizationId },
            transaction,
        }) : [];

        const entryLinks = await EntryIdentity.findAll({ where: { identityId }, transaction });
        const entryIds = entryLinks.map((row) => row.entryId);
        const linkedEntries = entryIds.length ? await Entry.findAll({
            where: { id: { [Op.in]: entryIds } },
            transaction,
        }) : [];
        const linkedFolderIds = [...new Set(linkedEntries.map((entry) => entry.folderId).filter(Boolean))];
        const linkedFolders = linkedFolderIds.length ? await Folder.findAll({
            where: { id: { [Op.in]: linkedFolderIds } },
            transaction,
        }) : [];
        const foldersById = new Map(linkedFolders.map((folder) => [folder.id, folder]));
        const invalidEntryIds = linkedEntries.filter((entry) => {
            const entryOrganizationId = entry.folderId
                ? foldersById.get(entry.folderId)?.organizationId || null
                : entry.organizationId || null;
            return entryOrganizationId !== organizationId;
        }).map((entry) => entry.id);

        await Identity.update({ accountId: null, organizationId }, { where: { id: identityId }, transaction });
        const targetFolderIds = new Set(organizationFolders.map((folder) => folder.id));
        const invalidProfileRowIds = profileRows
            .filter((row) => !targetFolderIds.has(row.folderId))
            .map((row) => row.id);
        if (invalidProfileRowIds.length) {
            await FolderIdentityProfile.destroy({ where: { id: { [Op.in]: invalidProfileRowIds } }, transaction });
        }
        if (organizationFolders.length) {
            await FolderIdentityProfile.update({ accountId: null }, {
                where: { identityId, folderId: { [Op.in]: organizationFolders.map((folder) => folder.id) } },
                transaction,
            });
        }
        if (invalidEntryIds.length) {
            await EntryIdentity.destroy({ where: { identityId, entryId: { [Op.in]: invalidEntryIds } }, transaction });
        }
    });
    logger.info("Identity moved to organization", { identityId, name: identity.name, organizationId });

    stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId });

    return { success: true, identity: { id: identity.id, name: identity.name, type: identity.type, organizationId, accountId: null } };
};

module.exports.getIdentity = async (accountId, identityId) => {
    const identity = await Identity.findByPk(identityId);
    const check = await validateAccess(accountId, identity);
    return check.valid ? identity : check.error;
};
