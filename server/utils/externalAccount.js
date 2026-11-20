const crypto = require("crypto");
const { verifyTotpCode } = require("./totp");
const { genSalt, hash } = require("bcrypt");
const Account = require("../models/Account");

const LINK_CONFLICT = {
    code: 204,
    message: "An account with this username already exists. Ask an administrator to allow linking it to your sign-in provider.",
};

const findExternalAccount = async ({ provider, externalId, username }) => {
    const linked = await Account.findOne({ where: { externalProvider: provider, externalId } });
    if (linked) return { account: linked, action: "login" };

    const existing = await Account.findOne({ where: { username } });
    if (!existing) return { account: null, action: "create" };
    if (!existing.externalProvider && existing.allowExternalLink) return { account: existing, action: "link" };
    return { account: null, action: "conflict" };
};

const verifyTotp = (account, code) => {
    if (!account?.totpEnabled) return null;
    if (!code) return { code: 202, message: "TOTP is required for this account" };
    return verifyTotpCode(account, code) ? null : { code: 203, message: "Your provided code is invalid or has expired." };
};

const applyExternalAccount = async (plan, { provider, externalId, username, firstName, lastName }) => {
    const names = { firstName, lastName };

    if (plan.action === "create") {
        const password = await hash(crypto.randomBytes(16).toString("hex"), await genSalt(10));
        return Account.create({ username, password, ...names, externalProvider: provider, externalId });
    }

    const link = plan.action === "link" ? { externalProvider: provider, externalId, allowExternalLink: false } : {};
    await Account.update({ ...names, ...link }, { where: { id: plan.account.id } });
    return Account.findByPk(plan.account.id);
};

module.exports = { LINK_CONFLICT, findExternalAccount, verifyTotp, applyExternalAccount };
