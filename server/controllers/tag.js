const Tag = require("../models/Tag");
const EntryTag = require("../models/EntryTag");
const Entry = require("../models/Entry");
const { validateEntryAccess } = require("./entry");
const { Op } = require("sequelize");

module.exports.createTag = async (accountId, { name, color }) => {
    if (!name || !color) return { code: 400, message: "Name and color are required" };

    const existingTag = await Tag.findOne({ where: { accountId, name } });
    if (existingTag) return { code: 409, message: "A tag with this name already exists" };

    return await Tag.create({ accountId, name, color });
};

module.exports.listTags = async (accountId) => {
    return await Tag.findAll({ where: { accountId }, order: [["name", "ASC"]] });
};

module.exports.updateTag = async (accountId, tagId, { name, color }) => {
    const tag = await Tag.findByPk(tagId);

    if (!tag) return { code: 404, message: "Tag not found" };
    if (tag.accountId !== accountId) return { code: 403, message: "You don't have permission to modify this tag" };


    if (name && name !== tag.name) {
        const existingTag = await Tag.findOne({ where: { accountId, name, id: { [Op.ne]: tagId } } });

        if (existingTag) return { code: 409, message: "A tag with this name already exists" };
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (color) updateData.color = color;

    await Tag.update(updateData, { where: { id: tagId } });

    return { success: true };
};

module.exports.deleteTag = async (accountId, tagId) => {
    const tag = await Tag.findByPk(tagId);

    if (!tag) return { code: 404, message: "Tag not found" };
    if (tag.accountId !== accountId) return { code: 403, message: "You don't have permission to delete this tag" };

    await EntryTag.destroy({ where: { tagId } });

    await Tag.destroy({ where: { id: tagId } });

    return { success: true };
};

module.exports.assignTagToEntry = async (accountId, entryId, tagId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to tag this entry");

    if (!accessCheck.valid) return accessCheck;

    const tag = await Tag.findByPk(tagId);
    if (!tag) return { code: 404, message: "Tag not found" };
    if (tag.accountId !== accountId) return { code: 403, message: "You don't have permission to use this tag" };

    const existingAssignment = await EntryTag.findOne({
        where: { entryId, tagId },
    });

    if (existingAssignment) return { code: 409, message: "This entry is already tagged with this tag" };


    await EntryTag.create({ entryId, tagId });

    return { success: true };
};

module.exports.removeTagFromEntry = async (accountId, entryId, tagId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry, "You don't have permission to untag this entry");

    if (!accessCheck.valid) return accessCheck;

    const tag = await Tag.findByPk(tagId);
    if (!tag) return { code: 404, message: "Tag not found" };


    if (tag.accountId !== accountId) return { code: 403, message: "You don't have permission to use this tag" };


    await EntryTag.destroy({ where: { entryId, tagId } });

    return { success: true };
};

module.exports.getEntryTags = async (accountId, entryId) => {
    const entry = await Entry.findByPk(entryId);
    const accessCheck = await validateEntryAccess(accountId, entry);

    if (!accessCheck.valid) return accessCheck;

    const entryTags = await EntryTag.findAll({
        where: { entryId },
    });

    const tagIds = entryTags.map(et => et.tagId);

    if (tagIds.length === 0) return [];

    const tags = await Tag.findAll({
        where: { id: { [Op.in]: tagIds } },
    });

    return tags;
};
