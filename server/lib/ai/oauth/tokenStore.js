const AISettings = require("../../../models/AISettings");

const persistTokens = async (settingsId, providerId, tokens, { accountId, expiresAt } = {}) => {
    const payload = {
        oauthProvider: providerId,
        oauthAccessToken: tokens.access_token,
        oauthRefreshToken: tokens.refresh_token,
        oauthExpiresAt: expiresAt ?? null,
        oauthVerifier: null,
    };
    if (accountId !== undefined) payload.oauthAccountId = accountId;

    await AISettings.update(AISettings.encryptSecrets(payload), { where: { id: settingsId } });
    return { accessToken: tokens.access_token, expiresAt: expiresAt ?? null, accountId };
};

const clearTokens = async (settingsId) => {
    await AISettings.update(AISettings.encryptSecrets({
        oauthProvider: null,
        oauthAccountId: null,
        oauthAccessToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
        oauthVerifier: null,
    }), { where: { id: settingsId } });
};

const parsePendingFlow = (stored) => {
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.verifier === "string") return parsed;
    } catch {}
    return { verifier: stored, state: null };
};

module.exports = { persistTokens, clearTokens, parsePendingFlow };
