const Script = require("../models/Script");
const { Op } = require("sequelize");

module.exports.createScript = async (accountId, configuration) => {
    return await Script.create({ ...configuration, accountId });
};

module.exports.deleteScript = async (accountId, scriptId, organizationId = null) => {
    const whereClause = organizationId
        ? { id: scriptId, organizationId }
        : { id: scriptId, accountId, organizationId: null };

    const script = await Script.findOne({ where: whereClause });

    if (script === null) {
        return { code: 404, message: "Script does not exist" };
    }

    if (script.sourceId) {
        return { code: 403, message: "Cannot delete source-synced scripts" };
    }

    await Script.destroy({ where: { id: scriptId } });
};

module.exports.editScript = async (accountId, scriptId, configuration, organizationId = null) => {
    const whereClause = organizationId
        ? { id: scriptId, organizationId }
        : { id: scriptId, accountId, organizationId: null };

    const script = await Script.findOne({ where: whereClause });

    if (script === null) {
        return { code: 404, message: "Script does not exist" };
    }

    if (script.sourceId) {
        return { code: 403, message: "Cannot edit source-synced scripts" };
    }

    const { organizationId: _, accountId: __, ...updateData } = configuration;
    await Script.update(updateData, { where: { id: scriptId } });
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
    if (organizationId) {
        return await Script.findAll({ where: { organizationId } });
    }
    return await Script.findAll({ where: { accountId, organizationId: null, sourceId: null } });
};

module.exports.searchScripts = async (accountId, search, organizationId = null) => {
    const whereClause = organizationId
        ? { organizationId }
        : { accountId, organizationId: null, sourceId: null };

    return await Script.findAll({
        where: {
            ...whereClause,
            [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
            ],
        },
    });
};

module.exports.listAllAccessibleScripts = async (accountId, organizationIds = []) => {
    const whereClause = {
        [Op.or]: [
            { accountId, organizationId: null, sourceId: null },
            ...(organizationIds.length > 0 ? [{ organizationId: { [Op.in]: organizationIds } }] : []),
        ],
    };
    return await Script.findAll({ where: whereClause });
};

module.exports.listSourceScripts = async (sourceId) => {
    return await Script.findAll({ where: { sourceId } });
};

module.exports.listAllSourceScripts = async () => {
    return await Script.findAll({
        where: {
            sourceId: { [Op.ne]: null },
        },
    });
};
