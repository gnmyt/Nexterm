const Script = require("../models/Script");
const { Op } = require("sequelize");
const { hasResourcePermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");

const getWhereClause = (id, accountId, organizationId) => organizationId
    ? { id, organizationId }
    : { id, accountId, organizationId: null };

const canManage = (accountId, organizationId) =>
    hasResourcePermission(accountId, organizationId, Permission.SCRIPTS_MANAGE);

module.exports.createScript = async (accountId, configuration) => {
    if (!(await canManage(accountId, configuration.organizationId)))
        return { code: 403, message: "You don't have permission to manage scripts" };

    const maxSortOrder = await Script.max('sortOrder', {
        where: configuration.organizationId 
            ? { organizationId: configuration.organizationId }
            : { accountId, organizationId: null, sourceId: null }
    }) || 0;
    return Script.create({ 
        ...configuration, 
        accountId: configuration.organizationId ? null : accountId,
        sortOrder: maxSortOrder + 1 
    });
};

module.exports.deleteScript = async (accountId, scriptId, organizationId = null) => {
    if (!(await canManage(accountId, organizationId)))
        return { code: 403, message: "You don't have permission to manage scripts" };
    const script = await Script.findOne({ where: getWhereClause(scriptId, accountId, organizationId) });
    if (!script) return { code: 404, message: "Script does not exist" };
    if (script.sourceId) return { code: 403, message: "Cannot delete source-synced scripts" };
    await Script.destroy({ where: { id: scriptId } });
};

module.exports.editScript = async (accountId, scriptId, configuration, organizationId = null) => {
    if (!(await canManage(accountId, organizationId)))
        return { code: 403, message: "You don't have permission to manage scripts" };
    const script = await Script.findOne({ where: getWhereClause(scriptId, accountId, organizationId) });
    if (!script) return { code: 404, message: "Script does not exist" };
    if (script.sourceId) return { code: 403, message: "Cannot edit source-synced scripts" };
    const { organizationId: _, accountId: __, ...updateData } = configuration;
    await Script.update(updateData, { where: { id: scriptId } });
};

module.exports.repositionScript = async (accountId, scriptId, { targetId }, organizationId = null) => {
    if (!targetId || parseInt(scriptId) === parseInt(targetId)) return { success: true };
    if (!(await canManage(accountId, organizationId)))
        return { code: 403, message: "You don't have permission to manage scripts" };

    const script = await Script.findOne({ where: getWhereClause(scriptId, accountId, organizationId) });
    if (!script) return { code: 404, message: "Script does not exist" };
    if (script.sourceId) return { code: 403, message: "Cannot reorder source-synced scripts" };
    
    const where = organizationId ? { organizationId } : { accountId, organizationId: null, sourceId: null };
    const all = await Script.findAll({ where, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
    
    const srcIdx = all.findIndex(s => s.id === parseInt(scriptId));
    const tgtIdx = all.findIndex(s => s.id === parseInt(targetId));
    if (srcIdx === -1 || tgtIdx === -1) return { code: 404, message: "Script not found" };
    
    all.splice(tgtIdx, 0, all.splice(srcIdx, 1)[0]);
    await Promise.all(all.map((s, i) => Script.update({ sortOrder: i + 1 }, { where: { id: s.id } })));
    return { success: true };
};

module.exports.getScript = async (accountId, scriptId, organizationId = null, organizationIds = []) => {
    if (organizationId) {
        const script = await Script.findOne({ where: { id: scriptId, organizationId } });
        if (script) return script;
    }

    const personalScript = await Script.findOne({
        where: {
            id: scriptId,
            accountId,
            organizationId: null,
            sourceId: null,
        },
    });
    if (personalScript) return personalScript;

    if (organizationIds.length > 0) {
        const orgScript = await Script.findOne({
            where: {
                id: scriptId,
                organizationId: { [Op.in]: organizationIds },
            },
        });
        if (orgScript) return orgScript;
    }

    const sourceScript = await Script.findOne({
        where: {
            id: scriptId,
            sourceId: { [Op.ne]: null },
        },
    });
    if (sourceScript) return sourceScript;

    return { code: 404, message: "Script does not exist" };
};

module.exports.listScripts = async (accountId, organizationId = null) => {
    const where = organizationId ? { organizationId } : { accountId, organizationId: null, sourceId: null };
    return Script.findAll({ where, order: [["sortOrder", "ASC"]] });
};

module.exports.searchScripts = async (accountId, search, organizationId = null) => {
    const base = organizationId ? { organizationId } : { accountId, organizationId: null, sourceId: null };
    return Script.findAll({
        where: { ...base, [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }] },
        order: [["sortOrder", "ASC"]]
    });
};

module.exports.listAllAccessibleScripts = async (accountId, organizationIds = []) => {
    return Script.findAll({ 
        where: {
            [Op.or]: [
                { accountId, organizationId: null, sourceId: null },
                ...(organizationIds.length > 0 ? [{ organizationId: { [Op.in]: organizationIds } }] : [])
            ]
        },
        order: [["sortOrder", "ASC"]]
    });
};

module.exports.listSourceScripts = async (sourceId) => 
    Script.findAll({ where: { sourceId }, order: [["sortOrder", "ASC"]] });

module.exports.listAllSourceScripts = async () => 
    Script.findAll({ where: { sourceId: { [Op.ne]: null } }, order: [["sortOrder", "ASC"]] });
