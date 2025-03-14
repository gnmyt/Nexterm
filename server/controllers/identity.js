const Identity = require("../models/Identity");
const { encrypt } = require("../utils/encryption");

module.exports.mapIdentitySecure = (identity) => {
    return {
        id: identity.id,
        name: identity.name,
        username: identity.username,
        type: identity.type,
    };
};

const encryptIdentity = (identity) => {
    if (identity.password && identity.password !== "********") {
        const encrypted = encrypt(identity.password);
        identity.password = encrypted.encrypted;
        identity.passwordIV = encrypted.iv;
        identity.passwordAuthTag = encrypted.authTag;
    }
    if (identity.sshKey) {
        const encrypted = encrypt(identity.sshKey);
        identity.sshKey = encrypted.encrypted;
        identity.sshKeyIV = encrypted.iv;
        identity.sshKeyAuthTag = encrypted.authTag;
    }
    if (identity.passphrase && identity.passphrase !== "********") {
        const encrypted = encrypt(identity.passphrase);
        identity.passphrase = encrypted.encrypted;
        identity.passphraseIV = encrypted.iv;
        identity.passphraseAuthTag = encrypted.authTag;
    }

    return identity;
};

module.exports.listIdentities = async (accountId) => {
    const identities = await Identity.findAll({ where: { accountId } });
    return identities.map(this.mapIdentitySecure);
};

module.exports.createIdentity = async (accountId, configuration) => {
    return await Identity.create({ accountId, ...encryptIdentity(configuration) });
};

module.exports.deleteIdentity = async (accountId, identityId) => {
    const identity = await Identity.findOne({ where: { accountId, id: identityId } });

    if (identity === null)
        return { code: 501, message: "The provided identity does not exist" };

    await Identity.destroy({ where: { accountId, id: identityId } });
};

module.exports.updateIdentity = async (accountId, identityId, configuration) => {
    const identity = await Identity.findOne({ where: { accountId, id: identityId } });

    if (identity === null)
        return { code: 501, message: "The provided identity does not exist" };

    await Identity.update(encryptIdentity(configuration), { where: { accountId, id: 3 } });
};