const Identity = require("../models/Identity");

module.exports.mapIdentitySecure = identity => {
    return { id: identity.id, name: identity.name, username: identity.username, type: identity.type };
};

module.exports.listIdentities = async accountId => {
    const identities = await Identity.findAll({ where: { accountId } });
    return identities.map(this.mapIdentitySecure);
};

module.exports.createIdentity = async (accountId, configuration) => {
    return await Identity.create({ accountId, ...configuration });
}

module.exports.deleteIdentity = async (accountId, identityId) => {
    const identity = await Identity.findOne({ where: { accountId, id: identityId } });

    if (identity === null)
        return { code: 501, message: "The provided identity does not exist" };

    await Identity.destroy({ where: { accountId, id: identityId } });
}

module.exports.updateIdentity = async (accountId, identityId, configuration) => {
    const identity = await Identity.findOne({ where: { accountId, id: identityId } });

    if (identity === null)
        return { code: 501, message: "The provided identity does not exist" };

    await Identity.update(configuration, { where: { accountId, id: identityId } });
}