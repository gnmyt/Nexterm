const Account = require("../models/Account");
const Session = require("../models/Session");
const { hashSessionToken } = require("../models/Session");
const { verifyTotpCode } = require("../utils/totp");
const { compare } = require("bcrypt");
const OIDCProvider = require("../models/OIDCProvider");
const { authenticateUser: ldapAuth, getEnabledProvider: getLdapProvider } = require("./ldap");
const logger = require("../utils/logger");
const stateBroadcaster = require("../lib/StateBroadcaster");
const sessionManager = require("../lib/SessionManager");
const { createLogoutUrlForSession } = require("./oidc");
const { logoutWithDependencies } = require("../utils/sessionLogout");
const { forgetSession } = require("../utils/sessionActivity");

module.exports.login = async (configuration, user) => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true, enabled: true } });
    const ldapProvider = await getLdapProvider();

    if (!internalProvider && !ldapProvider) {
        return { code: 403, message: "No login method is enabled" };
    }

    if (ldapProvider) {
        const ldapResult = await ldapAuth(configuration.username, configuration.password, user, configuration.code);
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
    if (account.totpEnabled && !verifyTotpCode(account, configuration.code))
        return { code: 203, message: "Your provided code is invalid or has expired." };

    // Create Session
    const session = await Session.create({
        accountId: account.id,
        ip: user.ip,
        userAgent: user.userAgent,
    });

    logger.system(`User ${account.username} logged in`, { accountId: account.id, ip: user.ip });

    return { token: session.token, totpRequired: account.totpEnabled };
};

module.exports.logout = async token => logoutWithDependencies(token, {
    logLogout: accountId => logger.system(`User logged out`, { accountId }),
    findSession: value => Session.findOne({ where: { tokenHash: hashSessionToken(value) } }),
    destroySession: value => Session.destroy({ where: { tokenHash: hashSessionToken(value) } }),
    removeSessionTerminals: sessionId => sessionManager.removeAllByAuthSessionId(sessionId),
    disconnectSessionViewers: sessionId => sessionManager.disconnectAuthSessionViewers(sessionId),
    forgetSessionActivity: sessionId => forgetSession(sessionId),
    warnSessionTeardown: (sessionId, error) => logger.warn(
        "Failed to terminate terminal sessions on logout",
        { sessionId, error: error?.message },
    ),
    broadcastLogout: sessionId => stateBroadcaster.forceLogoutSession(sessionId),
    createOIDCLogoutUrl: session => createLogoutUrlForSession(session),
    warnOIDCLogout: providerId => logger.warn(
        "OIDC provider logout could not be initiated; local logout completed",
        { providerId },
    ),
});
