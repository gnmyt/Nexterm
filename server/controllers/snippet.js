const Snippet = require("../models/Snippet");
const { Op } = require("sequelize");

const getWhereClause = (id, accountId, organizationId) => organizationId 
    ? { id, organizationId } 
    : { id, accountId, organizationId: null };

module.exports.createSnippet = async (accountId, configuration) => {
    const maxSortOrder = await Snippet.max('sortOrder', {
        where: configuration.organizationId 
            ? { organizationId: configuration.organizationId }
            : { accountId, organizationId: null, sourceId: null }
    }) || 0;
    return Snippet.create({ 
        ...configuration, 
        accountId: configuration.organizationId ? null : accountId,
        sortOrder: maxSortOrder + 1 
    });
};

module.exports.deleteSnippet = async (accountId, snippetId, organizationId = null) => {
    const snippet = await Snippet.findOne({ where: getWhereClause(snippetId, accountId, organizationId) });
    if (!snippet) return { code: 404, message: "Snippet does not exist" };
    if (snippet.sourceId) return { code: 403, message: "Cannot delete source-synced snippets" };
    await Snippet.destroy({ where: { id: snippetId } });
};

module.exports.editSnippet = async (accountId, snippetId, configuration, organizationId = null) => {
    const snippet = await Snippet.findOne({ where: getWhereClause(snippetId, accountId, organizationId) });
    if (!snippet) return { code: 404, message: "Snippet does not exist" };
    if (snippet.sourceId) return { code: 403, message: "Cannot edit source-synced snippets" };
    const { organizationId: _, accountId: __, ...updateData } = configuration;
    await Snippet.update(updateData, { where: { id: snippetId } });
};

module.exports.repositionSnippet = async (accountId, snippetId, { targetId }, organizationId = null) => {
    if (!targetId || parseInt(snippetId) === parseInt(targetId)) return { success: true };
    
    const snippet = await Snippet.findOne({ where: getWhereClause(snippetId, accountId, organizationId) });
    if (!snippet) return { code: 404, message: "Snippet does not exist" };
    if (snippet.sourceId) return { code: 403, message: "Cannot reorder source-synced snippets" };
    
    const where = organizationId ? { organizationId } : { accountId, organizationId: null, sourceId: null };
    const all = await Snippet.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    
    const srcIdx = all.findIndex(s => s.id === parseInt(snippetId));
    const tgtIdx = all.findIndex(s => s.id === parseInt(targetId));
    if (srcIdx === -1 || tgtIdx === -1) return { code: 404, message: "Snippet not found" };
    
    all.splice(tgtIdx, 0, all.splice(srcIdx, 1)[0]);
    await Promise.all(all.map((s, i) => Snippet.update({ sortOrder: i + 1 }, { where: { id: s.id } })));
    return { success: true };
};

module.exports.getSnippet = async (accountId, snippetId, organizationId = null) => {
    const snippet = await Snippet.findOne({ where: getWhereClause(snippetId, accountId, organizationId) });
    return snippet || { code: 404, message: "Snippet does not exist" };
};

module.exports.listSnippets = async (accountId, organizationId = null) => {
    const where = organizationId ? { organizationId } : { accountId, organizationId: null, sourceId: null };
    return Snippet.findAll({ where, order: [["sortOrder", "ASC"]] });
};

module.exports.listAllAccessibleSnippets = async (accountId, organizationIds = []) => {
    return Snippet.findAll({ 
        where: {
            [Op.or]: [
                { accountId, organizationId: null, sourceId: null },
                ...(organizationIds.length > 0 ? [{ organizationId: { [Op.in]: organizationIds } }] : [])
            ]
        },
        order: [["sortOrder", "ASC"]]
    });
};

module.exports.listSourceSnippets = async (sourceId) => 
    Snippet.findAll({ where: { sourceId }, order: [["sortOrder", "ASC"]] });

module.exports.listAllSourceSnippets = async () => 
    Snippet.findAll({ where: { sourceId: { [Op.ne]: null } }, order: [["sortOrder", "ASC"]] });