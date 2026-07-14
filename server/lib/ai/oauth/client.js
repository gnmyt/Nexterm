const AISettings = require("../../../models/AISettings");
const logger = require("../../../utils/logger");
const { createPkce } = require("./pkce");
const { persistTokens, clearTokens, parsePendingFlow } = require("./tokenStore");

const TOKEN_REFRESH_MARGIN_MS = 60_000;

const defaultParseCode = (raw) => {
    const [code, state] = String(raw).trim().split("#");
    return { code, state: state || null };
};

const createOAuthClient = (config) => {
    const {
        id, label, clientId, authorizeUrl, tokenUrl, redirectUri, scope,
        tokenFormat = "json",
        authorizeParams = () => ({}),
        exchangeBody,
        refreshBody,
        parseCode = defaultParseCode,
        deriveAccount,
        deriveExpiry,
    } = config;

    const computeExpiry = (tokens) => {
        if (deriveExpiry) {
            const explicit = deriveExpiry(tokens);
            if (explicit) return explicit;
        }
        return tokens.expires_in ? Date.now() + Number(tokens.expires_in) * 1000 : null;
    };

    const formatFor = (op) => (typeof tokenFormat === "string" ? tokenFormat : tokenFormat[op] || "json");

    const postToken = (params, op) => {
        if (formatFor(op) === "form") {
            return fetch(tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(params).toString(),
            });
        }
        return fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
        });
    };

    const generateAuthUrl = async () => {
        const { verifier, challenge, state } = createPkce();

        const settings = await AISettings.getOrCreate();
        await AISettings.update(
            { oauthVerifier: JSON.stringify({ verifier, state }) },
            { where: { id: settings.id } },
        );

        const params = new URLSearchParams({
            client_id: clientId,
            response_type: "code",
            redirect_uri: redirectUri,
            scope,
            code_challenge: challenge,
            code_challenge_method: "S256",
            state,
            ...authorizeParams(challenge, state),
        });

        return `${authorizeUrl}?${params.toString()}`;
    };

    const exchangeCode = async (rawCode) => {
        const settings = await AISettings.getOrCreate();
        const pending = parsePendingFlow(settings.oauthVerifier);
        if (!pending) return { code: 400, message: "No pending authorization. Start the connection again." };
        const { verifier, state } = pending;

        const { code, state: stateFromCode } = parseCode(rawCode);
        if (state && stateFromCode && stateFromCode !== state) {
            return { code: 400, message: "Authorization state mismatch. Start the connection again." };
        }

        const response = await postToken(exchangeBody({
            code,
            state: stateFromCode || state || verifier,
            verifier,
        }), "exchange");

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            logger.error(`${label} OAuth code exchange failed`, { status: response.status, detail: detail.slice(0, 200) });
            return { code: 400, message: `Failed to connect ${label} subscription. The code may be invalid or expired.` };
        }

        const tokens = await response.json();
        if (!tokens.access_token || !tokens.refresh_token) {
            return { code: 400, message: `${label} did not return a valid token.` };
        }

        const accountId = deriveAccount ? (deriveAccount(tokens) ?? null) : undefined;
        await persistTokens(settings.id, id, tokens, { accountId, expiresAt: computeExpiry(tokens) });
        return { success: true };
    };

    const refresh = async (settings) => {
        const response = await postToken(refreshBody({ refreshToken: settings.oauthRefreshToken }), "refresh");

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            logger.error(`${label} OAuth token refresh failed`, { status: response.status, detail: detail.slice(0, 200) });
            throw new Error(`${label} subscription session expired. Reconnect in the AI settings.`);
        }

        const tokens = await response.json();
        if (!tokens.refresh_token) tokens.refresh_token = settings.oauthRefreshToken;
        const derived = deriveAccount ? deriveAccount(tokens) : undefined;
        const accountId = derived == null ? settings.oauthAccountId : derived;
        return persistTokens(settings.id, id, tokens, { accountId, expiresAt: computeExpiry(tokens) });
    };

    const ensureFreshToken = async (settings) => {
        if (!settings.oauthRefreshToken) throw new Error(`${label} subscription is not connected.`);

        const expiresAt = Number(settings.oauthExpiresAt) || 0;
        const stillValid = settings.oauthAccessToken && expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS;
        if (stillValid) {
            return { accessToken: settings.oauthAccessToken, expiresAt, accountId: settings.oauthAccountId };
        }

        return refresh(settings);
    };

    const disconnect = async () => {
        const settings = await AISettings.getOrCreate();
        await clearTokens(settings.id);
        return { success: true };
    };

    return { id, label, generateAuthUrl, exchangeCode, ensureFreshToken, disconnect };
};

module.exports = { createOAuthClient };
