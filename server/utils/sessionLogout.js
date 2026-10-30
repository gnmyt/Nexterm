const logoutWithDependencies = async (token, dependencies) => {
    const session = await dependencies.findSession(token);

    if (session === null)
        return { code: 204, message: "Your session token is invalid" };

    dependencies.logLogout(session.accountId);

    await dependencies.destroySession(token);
    dependencies.removeAccountSessions(session.accountId);
    dependencies.broadcastLogout(session.id);

    let logoutUrl = null;
    if (session.oidcProviderId) {
        try {
            logoutUrl = await dependencies.createOIDCLogoutUrl(session);
        } catch (_) {
            dependencies.warnOIDCLogout(session.oidcProviderId);
        }
    }

    return {
        message: "Your session got deleted successfully",
        ...(logoutUrl ? { logoutUrl } : {}),
    };
};

module.exports = { logoutWithDependencies };
