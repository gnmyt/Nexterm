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

    const { organizationId: _, accountId: __, ...updateData } = configuration;
    await Script.update(updateData, { where: { id: scriptId } });
};

module.exports.getScript = async (accountId, scriptId, organizationId = null) => {
    const whereClause = organizationId
        ? { id: scriptId, organizationId }
        : { id: scriptId, accountId, organizationId: null };

    const script = await Script.findOne({ where: whereClause });

    if (script === null) {
        return { code: 404, message: "Script does not exist" };
    }

    return script;
};

module.exports.listScripts = async (accountId, organizationId = null) => {
    if (organizationId) {
        return await Script.findAll({ where: { organizationId } });
    }
    return await Script.findAll({ where: { accountId, organizationId: null } });
};

module.exports.searchScripts = async (accountId, search, organizationId = null) => {
    const whereClause = organizationId
        ? { organizationId }
        : { accountId, organizationId: null };

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
            { accountId, organizationId: null },
            ...(organizationIds.length > 0 ? [{ organizationId: { [Op.in]: organizationIds } }] : []),
        ],
    };
    return await Script.findAll({ where: whereClause });
};
