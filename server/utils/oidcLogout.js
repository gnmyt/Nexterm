const client = require("openid-client");

const normalizeProviderData = (data) => {
    if (!Object.prototype.hasOwnProperty.call(data, "endSessionEndpoint")) return data;
    return { ...data, endSessionEndpoint: data.endSessionEndpoint?.trim() || null };
};

const parseHTTPUrl = (value, description) => {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`${description} must use HTTP or HTTPS`);
    }
    return url;
};

const getPostLogoutRedirectUri = (loginRedirectUri) => {
    const url = parseHTTPUrl(loginRedirectUri, "OIDC callback URL");
    const loginCallbackPath = "/api/auth/oidc/callback";
    const normalizedPath = url.pathname.replace(/\/+$/, "");

    if (!normalizedPath.endsWith(loginCallbackPath)) {
        throw new Error("OIDC callback URL has an unexpected path");
    }

    const pathPrefix = normalizedPath.slice(0, -loginCallbackPath.length);
    url.pathname = `${pathPrefix}/api/auth/oidc/logout/callback`;
    url.search = "";
    url.hash = "";
    return url.href;
};

const addLogoutParameters = (url, provider, idToken) => {
    url.searchParams.set("client_id", provider.clientId);
    url.searchParams.set("id_token_hint", idToken);
    url.searchParams.set("post_logout_redirect_uri", getPostLogoutRedirectUri(provider.redirectUri));
    return url;
};

const buildOIDCLogoutUrl = async (provider, idToken, dependencies = {}) => {
    if (!provider || !idToken) return null;

    if (provider.endSessionEndpoint) {
        const endpoint = parseHTTPUrl(provider.endSessionEndpoint, "OIDC end-session endpoint");
        return addLogoutParameters(endpoint, provider, idToken).href;
    }

    const discover = dependencies.discovery || client.discovery;
    const buildEndSessionUrl = dependencies.buildEndSessionUrl || client.buildEndSessionUrl;
    const configuration = await discover(
        new URL(provider.issuer),
        provider.clientId,
        provider.clientSecret,
    );

    if (!configuration.serverMetadata().end_session_endpoint) {
        throw new Error("OIDC provider does not advertise an end-session endpoint");
    }

    const logoutUrl = buildEndSessionUrl(configuration, {
        client_id: provider.clientId,
        id_token_hint: idToken,
        post_logout_redirect_uri: getPostLogoutRedirectUri(provider.redirectUri),
    });
    return parseHTTPUrl(logoutUrl, "Discovered OIDC end-session endpoint").href;
};

module.exports = { buildOIDCLogoutUrl, getPostLogoutRedirectUri, normalizeProviderData };
