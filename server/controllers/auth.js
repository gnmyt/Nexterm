const Account = require("../models/Account");
const Session = require("../models/Session");
const speakeasy = require("speakeasy");
const { compare } = require("bcrypt");
const OIDCProvider = require("../models/OIDCProvider");
const { authenticateUser: ldapAuth, getEnabledProvider: getLdapProvider } = require("./ldap");
const logger = require("../utils/logger");
const stateBroadcaster = require("../lib/StateBroadcaster");
const sessionManager = require("../lib/SessionManager");

// Login response codes (application-specific, not HTTP status codes)
const LOGIN_FAILED = 201;
const TOTP_REQUIRED = 202;
const TOTP_INVALID = 203;
const TOKEN_INVALID = 204;
const NO_LOGIN_METHOD = 403;

const USERNAME_OR_PASSWORD_INCORRECT = "Username or password incorrect";

const verifyInternalCredentials = async (account, password) => {
    if (!account) {
        return { code: LOGIN_FAILED, message: USERNAME_OR_PASSWORD_INCORRECT };
    }
    if (!(await compare(password, account.password))) {
        return { code: LOGIN_FAILED, message: USERNAME_OR_PASSWORD_INCORRECT };
    }
    return null;
};

const verifyTotp = (account, code) => {
    if (!account.totpEnabled) {
        return null;
    }
    if (!code) {
        return { code: TOTP_REQUIRED, message: "TOTP is required for this account" };
    }
    const tokenCorrect = speakeasy.totp.verify({
        secret: account.totpSecret || "",
        encoding: "base32",
        token: code,
    });
    if (!tokenCorrect) {
        return { code: TOTP_INVALID, message: "Your provided code is invalid or has expired." };
    }
    return null;
};

const createSessionFor = async (account, user) => {
    const session = await Session.create({
        accountId: account.id,
        ip: user.ip,
        userAgent: user.userAgent,
    });
    logger.system(`User ${account.username} logged in`, { accountId: account.id, ip: user.ip });
    return session;
};

module.exports.login = async (configuration, user) => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true, enabled: true } });
    const ldapProvider = await getLdapProvider();

    if (!internalProvider && !ldapProvider) {
        return { code: NO_LOGIN_METHOD, message: "No login method is enabled" };
    }

    if (ldapProvider) {
        const ldapResult = await ldapAuth(configuration.username, configuration.password, user);
        if (ldapResult) return ldapResult;
        return { code: LOGIN_FAILED, message: USERNAME_OR_PASSWORD_INCORRECT };
    }

    const account = await Account.findOne({ where: { username: configuration.username } });
    const credError = await verifyInternalCredentials(account, configuration.password);
    if (credError) return credError;

    const totpError = verifyTotp(account, configuration.code);
    if (totpError) return totpError;

    const session = await createSessionFor(account, user);
    return { token: session.token, totpRequired: account.totpEnabled };
};

module.exports.logout = async token => {
    const session = await Session.findOne({ where: { token } });

    if (session === null)
        return { code: TOKEN_INVALID, message: "Your session token is invalid" };

    logger.system(`User logged out`, { accountId: session.accountId });

    await Session.destroy({ where: { token } });
    sessionManager.removeAllByAccountId(session.accountId);
    stateBroadcaster.forceLogoutSession(session.id);
};
