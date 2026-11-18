const speakeasy = require("speakeasy");
const Account = require("../models/Account");
const { encrypt, decrypt } = require("./encryption");

const getTotpSecret = (account) => {
    if (!account?.totpSecretEncrypted) return null;
    return decrypt(account.totpSecretEncrypted, account.totpSecretIV, account.totpSecretAuthTag);
};

const verifyTotpCode = (account, code) => {
    const secret = getTotpSecret(account);
    if (!secret || !code) return false;
    return speakeasy.totp.verify({ secret, encoding: "base32", token: String(code) });
};

const startTotpSetup = async (account) => {
    const secret = speakeasy.generateSecret({ name: "Nexterm" }).base32;
    const sealed = encrypt(secret);
    await Account.update({
        totpSecretEncrypted: sealed.encrypted,
        totpSecretIV: sealed.iv,
        totpSecretAuthTag: sealed.authTag,
    }, { where: { id: account.id } });
    return secret;
};

const clearTotpSecret = (accountId) => Account.update({
    totpSecretEncrypted: null, totpSecretIV: null, totpSecretAuthTag: null,
}, { where: { id: accountId } });

module.exports = { getTotpSecret, verifyTotpCode, startTotpSetup, clearTotpSecret };
