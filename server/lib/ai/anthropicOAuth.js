const crypto = require("crypto");
const AISettings = require("../../models/AISettings");
const logger = require("../../utils/logger");

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const SCOPES = "org:create_api_key user:profile user:inference";

const OAUTH_BETA = "oauth-2025-04-20";
const ANTHROPIC_VERSION = "2023-06-01";

const base64Url = (buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

module.exports.OAUTH_BETA = OAUTH_BETA;

module.exports.generateAuthUrl = async () => {
    const verifier = base64Url(crypto.randomBytes(32));
    const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
    const state = base64Url(crypto.randomBytes(32));

    const settings = await AISettings.getOrCreate();
    await AISettings.update({ oauthVerifier: JSON.stringify({ verifier, state }) }, { where: { id: settings.id } });

    const params = new URLSearchParams({
        code: "true",
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
    });

    return `${AUTHORIZE_URL}?${params.toString()}`;
};

const parsePendingFlow = (stored) => {
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.verifier === "string") return parsed;
    } catch {}
    return { verifier: stored, state: null };
};

const persistTokens = async (settingsId, tokens) => {
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
    await AISettings.update(AISettings.encryptSecrets({
        oauthAccessToken: tokens.access_token,
        oauthRefreshToken: tokens.refresh_token,
        oauthExpiresAt: expiresAt,
        oauthVerifier: null,
    }), { where: { id: settingsId } });
    return { accessToken: tokens.access_token, expiresAt };
};

module.exports.exchangeCode = async (rawCode) => {
    const settings = await AISettings.getOrCreate();
    const pending = parsePendingFlow(settings.oauthVerifier);
    if (!pending) return { code: 400, message: "No pending authorization. Start the connection again." };
    const { verifier, state } = pending;

    const [code, stateFromCode] = String(rawCode).trim().split("#");

    if (state && stateFromCode && stateFromCode !== state) {
        return { code: 400, message: "Authorization state mismatch. Start the connection again." };
    }

    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            state: stateFromCode || state || verifier,
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        logger.error("Anthropic OAuth code exchange failed", { status: response.status, detail: detail.slice(0, 200) });
        return { code: 400, message: "Failed to connect Claude subscription. The code may be invalid or expired." };
    }

    const tokens = await response.json();
    if (!tokens.access_token || !tokens.refresh_token) {
        return { code: 400, message: "Anthropic did not return a valid token." };
    }

    await persistTokens(settings.id, tokens);
    return { success: true };
};

const refreshToken = async (settings) => {
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: settings.oauthRefreshToken,
            client_id: CLIENT_ID,
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        logger.error("Anthropic OAuth token refresh failed", { status: response.status, detail: detail.slice(0, 200) });
        throw new Error("Claude subscription session expired. Reconnect in the AI settings.");
    }

    const tokens = await response.json();
    if (!tokens.refresh_token) tokens.refresh_token = settings.oauthRefreshToken;
    return persistTokens(settings.id, tokens);
};

module.exports.ensureFreshToken = async (settings) => {
    if (!settings.oauthRefreshToken) throw new Error("Claude subscription is not connected.");

    const expiresAt = Number(settings.oauthExpiresAt) || 0;
    const stillValid = settings.oauthAccessToken && expiresAt > Date.now() + 60_000;
    if (stillValid) return { accessToken: settings.oauthAccessToken, expiresAt };

    return refreshToken(settings);
};

module.exports.buildHeaders = async (settings) => {
    if ((settings.anthropicAuthMethod || "api_key") === "subscription") {
        const { accessToken } = await module.exports.ensureFreshToken(settings);
        return {
            "Authorization": `Bearer ${accessToken}`,
            "anthropic-beta": OAUTH_BETA,
            "anthropic-version": ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        };
    }

    return {
        "x-api-key": settings.apiKey || "",
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    };
};

module.exports.disconnect = async () => {
    const settings = await AISettings.getOrCreate();
    await AISettings.update(AISettings.encryptSecrets({
        oauthAccessToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        oauthVerifier: null,
    }), { where: { id: settings.id } });
    return { success: true };
};
