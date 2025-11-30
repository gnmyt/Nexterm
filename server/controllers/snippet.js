const Snippet = require("../models/Snippet");
const { Op } = require("sequelize");

module.exports.createSnippet = async (accountId, configuration) => {
    return await Snippet.create({ ...configuration, accountId });
};

module.exports.deleteSnippet = async (accountId, snippetId, organizationId = null) => {
    const whereClause = organizationId 
        ? { id: snippetId, organizationId }
        : { id: snippetId, accountId, organizationId: null };

    const snippet = await Snippet.findOne({ where: whereClause });

    if (snippet === null) {
        return { code: 404, message: "Snippet does not exist" };
    }

    if (snippet.sourceId) {
        return { code: 403, message: "Cannot delete source-synced snippets" };
    }

    await Snippet.destroy({ where: { id: snippetId } });
};

module.exports.editSnippet = async (accountId, snippetId, configuration, organizationId = null) => {
    const whereClause = organizationId 
        ? { id: snippetId, organizationId }
        : { id: snippetId, accountId, organizationId: null };

    const snippet = await Snippet.findOne({ where: whereClause });

    if (snippet === null) {
        return { code: 404, message: "Snippet does not exist" };
    }

    if (snippet.sourceId) {
        return { code: 403, message: "Cannot edit source-synced snippets" };
    }

    const { organizationId: _, accountId: __, ...updateData } = configuration;
    await Snippet.update(updateData, { where: { id: snippetId } });
};

module.exports.getSnippet = async (accountId, snippetId, organizationId = null) => {
    const whereClause = organizationId 
        ? { id: snippetId, organizationId }
        : { id: snippetId, accountId, organizationId: null };

    const snippet = await Snippet.findOne({ where: whereClause });

    if (snippet === null) {
        return { code: 404, message: "Snippet does not exist" };
    }

    return snippet;
};

module.exports.listSnippets = async (accountId, organizationId = null) => {
    if (organizationId) {
        return await Snippet.findAll({ where: { organizationId } });
    }
    return await Snippet.findAll({ where: { accountId, organizationId: null, sourceId: null } });
};

module.exports.listAllAccessibleSnippets = async (accountId, organizationIds = []) => {
    const whereClause = {
        [Op.or]: [
            { accountId, organizationId: null, sourceId: null },
            ...(organizationIds.length > 0 ? [{ organizationId: { [Op.in]: organizationIds } }] : [])
        ]
    };
    return await Snippet.findAll({ where: whereClause });
};

module.exports.listSourceSnippets = async (sourceId) => {
    return await Snippet.findAll({ where: { sourceId } });
};

module.exports.listAllSourceSnippets = async () => {
    return await Snippet.findAll({ 
        where: { 
            sourceId: { [Op.ne]: null } 
        } 
    });
};