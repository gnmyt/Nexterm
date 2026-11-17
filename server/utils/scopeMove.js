const { Op } = require("sequelize");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Folder = require("../models/Folder");
const Identity = require("../models/Identity");
const OrganizationMember = require("../models/OrganizationMember");
const { isIdentityAllowedForScope } = require("./resourceValidation");

const collectSubtreeEntries = async (folderId, transaction) => {
    const entries = await Entry.findAll({ where: { folderId }, transaction });
    const children = await Folder.findAll({ where: { parentId: folderId }, transaction });
    for (const child of children) entries.push(...await collectSubtreeEntries(child.id, transaction));
    return entries;
};

const getAllowedPersonalAccountIds = async (organizationId, accountId, transaction) => {
    if (!organizationId) return new Set([accountId]);
    const memberships = await OrganizationMember.findAll({
        where: { organizationId, status: "active" },
        attributes: ["accountId"],
        transaction,
    });
    return new Set(memberships.map((membership) => membership.accountId));
};

const removeUnavailableEntryIdentities = async (entryIds, organizationId, allowedPersonalAccountIds, transaction) => {
    if (!entryIds.length) return 0;
    const links = await EntryIdentity.findAll({ where: { entryId: { [Op.in]: entryIds } }, transaction });
    if (!links.length) return 0;

    const identities = await Identity.findAll({ where: { id: [...new Set(links.map((link) => link.identityId))] }, transaction });
    const allowedIds = new Set(identities
        .filter((identity) => isIdentityAllowedForScope(identity, organizationId, allowedPersonalAccountIds))
        .map((identity) => identity.id));
    const removed = links.filter((link) => !allowedIds.has(link.identityId));
    for (const link of removed) {
        await EntryIdentity.destroy({ where: { entryId: link.entryId, identityId: link.identityId }, transaction });
    }
    const removedIds = [...new Set(removed.map((link) => link.identityId))];
    if (removedIds.length) {
        await Identity.update({ entryId: null }, { where: { id: { [Op.in]: removedIds }, entryId: { [Op.in]: entryIds } }, transaction });
    }
    return removed.length;
};

module.exports = { collectSubtreeEntries, getAllowedPersonalAccountIds, removeUnavailableEntryIdentities };
