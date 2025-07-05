const Account = require("../models/Account");
const Session = require("../models/Session");
const speakeasy = require("speakeasy");
const { compare } = require("bcrypt");
const OIDCProvider = require("../models/OIDCProvider");

module.exports.login = async (configuration, user) => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true, enabled: true } });
    if (!internalProvider) return { code: 403, message: "Internal authentication is disabled" };

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

    return { token: session.token, totpRequired: account.totpEnabled };
};

module.exports.logout = async token => {
    const session = await Session.findOne({ where: { token } });

    if (session === null)
        return { code: 204, message: "Your session token is invalid" };

    await Session.destroy({ where: { token } });
};
