const { createOAuthClient } = require("./client");
const { decodeJwtPayload } = require("./pkce");

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const SCOPES = "openid profile email offline_access";

const AUTH_CLAIM = "https://api.openai.com/auth";

const deriveAccount = (tokens) => {
    const payload = decodeJwtPayload(tokens.id_token);
    return payload?.[AUTH_CLAIM]?.chatgpt_account_id || null;
};

const deriveExpiry = (tokens) => {
    const payload = decodeJwtPayload(tokens.access_token) || decodeJwtPayload(tokens.id_token);
    return payload?.exp ? payload.exp * 1000 : null;
};

const parseCode = (raw) => {
    const trimmed = String(raw).trim();
    if (trimmed.includes("code=")) {
        try {
            const url = new URL(trimmed, "http://localhost");
            const code = url.searchParams.get("code");
            if (code) return { code, state: url.searchParams.get("state") };
        } catch {}
    }
    const [code, state] = trimmed.split("#");
    return { code, state: state || null };
};

const client = createOAuthClient({
    id: "openai_codex",
    label: "ChatGPT",
    clientId: CLIENT_ID,
    authorizeUrl: AUTHORIZE_URL,
    tokenUrl: TOKEN_URL,
    redirectUri: REDIRECT_URI,
    scope: SCOPES,
    tokenFormat: { exchange: "form", refresh: "json" },
    authorizeParams: () => ({
        id_token_add_organizations: "true",
        codex_cli_simplified_flow: "true",
        originator: "codex_cli_rs",
    }),
    exchangeBody: ({ code, verifier }) => ({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
    }),
    refreshBody: ({ refreshToken }) => ({
        client_id: CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    }),
    parseCode,
    deriveAccount,
    deriveExpiry,
});

module.exports = { client, CLIENT_ID };
