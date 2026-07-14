const { createOAuthClient } = require("./client");

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const SCOPES = "org:create_api_key user:profile user:inference";

const OAUTH_BETA = "oauth-2025-04-20";

const client = createOAuthClient({
    id: "anthropic",
    label: "Claude",
    clientId: CLIENT_ID,
    authorizeUrl: AUTHORIZE_URL,
    tokenUrl: TOKEN_URL,
    redirectUri: REDIRECT_URI,
    scope: SCOPES,
    tokenFormat: "json",
    authorizeParams: () => ({ code: "true" }),
    exchangeBody: ({ code, state, verifier }) => ({
        grant_type: "authorization_code",
        code,
        state,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
    }),
    refreshBody: ({ refreshToken }) => ({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
    }),
});

module.exports = { client, OAUTH_BETA };
