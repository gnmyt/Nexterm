const Account = require("../models/Account");
const Session = require("../models/Session");
const speakeasy = require("speakeasy");
const { compare } = require("bcrypt");
const OIDCProvider = require("../models/OIDCProvider");
const { authenticateUser: ldapAuth, getEnabledProvider: getLdapProvider } = require("./ldap");
const logger = require("../utils/logger");

module.exports.login = async (configuration, user) => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true, enabled: true } });
    const ldapProvider = await getLdapProvider();

    if (!internalProvider && !ldapProvider) {
        return { code: 403, message: "No login method is enabled" };
    }

    if (ldapProvider) {
        const ldapResult = await ldapAuth(configuration.username, configuration.password, user);
        if (ldapResult) return ldapResult;
        return { code: 201, message: "Username or password incorrect" };
    }

    const account = await Account.findOne({ where: { username: configuration.username } });

    // Check if account exists
    if (account === null)
        return { code: 201, message: "Username or password incorrect" };

    // Check if password is correct
    if (!(await compare(configuration.password, account.password)))
        return { code: 201, message: "Username or password incorrect" };

    // Check if TOTP is required
    if (account.totpEnabled && !configuration.code)
        return { code: 202, message: "TOTP is required for this account" };

    // Check if TOTP is correct
    if (account.totpEnabled) {
        const tokenCorrect = speakeasy.totp.verify({
            secret: account.totpSecret || "",
            encoding: "base32",
            token: configuration.code,
        });

        if (!tokenCorrect)
            return { code: 203, message: "Your provided code is invalid or has expired." };
    }

    // Create Session
    const session = await Session.create({
        accountId: account.id,
        ip: user.ip,
        userAgent: user.userAgent,
    });

    logger.system(`User ${account.username} logged in`, { accountId: account.id, ip: user.ip });

    return { token: session.token, totpRequired: account.totpEnabled };
};

module.exports.logout = async token => {
    const session = await Session.findOne({ where: { token } });

    if (session === null)
        return { code: 204, message: "Your session token is invalid" };

    logger.system(`User logged out`, { accountId: session.accountId });

    await Session.destroy({ where: { token } });
};
