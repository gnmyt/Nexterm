const AISettings = require("../models/AISettings");
const logger = require("../utils/logger");
const { getProvider, describeProviders, getProviderOAuth, isSubscriptionConnected } = require("../lib/ai/providers");
const { generateCommand } = require("../lib/ai/commandGen");
const SessionManager = require("../lib/SessionManager");
const Entry = require("../models/Entry");

const isConfigured = (settings) => {
    if (!settings?.enabled || !settings.provider || !settings.model) return false;
    const provider = getProvider(settings.provider);
    if (!provider) return false;
    return provider.validate(settings) === null;
};

const sanitizeSettingsResponse = (settings) => ({
    id: settings.id,
    enabled: Boolean(settings.enabled),
    provider: settings.provider,
    model: settings.model,
    apiUrl: settings.apiUrl,
    authMethod: settings.authMethod,
    requireConfirmation: Boolean(settings.requireConfirmation),
    isConfigured: isConfigured(settings),
    hasApiKey: Boolean(settings.apiKey),
    subscriptionConnected: isSubscriptionConnected(settings),
    subscriptionProvider: settings.oauthRefreshToken ? settings.oauthProvider : null,
});

const resolveOAuthClient = async (providerId) => {
    let id = providerId;
    if (!id) {
        const settings = await AISettings.findOne();
        id = settings?.provider;
    }
    if (!id) return { error: { code: 400, message: "No AI provider selected" } };
    const oauth = getProviderOAuth(id);
    if (!oauth) return { error: { code: 400, message: "Selected provider does not support subscription login" } };
    return { oauth };
};

module.exports.getRuntimeSettings = async () => AISettings.findOne();

module.exports.isConfigured = isConfigured;

module.exports.getProviders = () => ({ providers: describeProviders() });

module.exports.getAISettings = async () => {
    const settings = await AISettings.getOrCreate();
    return sanitizeSettingsResponse(settings);
};

module.exports.updateAISettings = async (updateData) => {
    const { enabled, provider, model, apiKey, apiUrl, authMethod, requireConfirmation } = updateData;
    const settings = await AISettings.getOrCreate();

    const payload = {};
    if (enabled !== undefined) payload.enabled = enabled;
    if (provider !== undefined) payload.provider = provider;
    if (model !== undefined) payload.model = model;
    if (apiUrl !== undefined) payload.apiUrl = apiUrl;
    if (authMethod !== undefined) payload.authMethod = authMethod;
    if (requireConfirmation !== undefined) payload.requireConfirmation = requireConfirmation;
    if (apiKey !== undefined) payload.apiKey = apiKey === "" ? null : apiKey;

    await AISettings.update(AISettings.encryptSecrets(payload), { where: { id: settings.id } });

    return sanitizeSettingsResponse(await AISettings.findOne());
};

module.exports.startOAuth = async (providerId) => {
    const { oauth, error } = await resolveOAuthClient(providerId);
    if (error) return error;
    return { authUrl: await oauth.generateAuthUrl() };
};

module.exports.exchangeOAuth = async (code, providerId) => {
    const { oauth, error } = await resolveOAuthClient(providerId);
    if (error) return error;
    return oauth.exchangeCode(code);
};

module.exports.disconnectOAuth = async (providerId) => {
    const { oauth, error } = await resolveOAuthClient(providerId);
    if (error) return error;
    return oauth.disconnect();
};

const resolveConfiguredProvider = (settings, { requireEnabled = true } = {}) => {
    if (!settings) return { error: { code: 400, message: "No AI provider configured" } };
    if (requireEnabled && !settings.enabled) return { error: { code: 400, message: "AI is not enabled" } };
    if (!settings.provider) return { error: { code: 400, message: "No AI provider configured" } };
    const provider = getProvider(settings.provider);
    if (!provider) return { error: { code: 400, message: "Unsupported provider" } };
    const validationError = provider.validate(settings);
    if (validationError) return { error: { code: 400, message: validationError } };
    return { provider };
};

module.exports.testAIConnection = async () => {
    const settings = await AISettings.findOne();
    if (!settings?.model) return { code: 400, message: "No AI model configured" };

    const { provider, error } = resolveConfiguredProvider(settings);
    if (error) return error;

    try {
        const models = await provider.listModels(settings);
        if (models.error) return models.error;

        if (!models.list.includes(settings.model)) {
            return { code: 400, message: `Configured model "${settings.model}" not found in ${provider.label}` };
        }

        return { success: true, message: "Connection test successful" };
    } catch (error) {
        logger.error("AI connection test failed", { error: error.message });
        return { code: 500, message: `Connection test failed: ${error.message}` };
    }
};

module.exports.getAvailableModels = async () => {
    const settings = await AISettings.findOne();
    const { provider, error } = resolveConfiguredProvider(settings, { requireEnabled: false });
    if (error) return error;

    try {
        const result = await provider.listModels(settings);
        if (result.error) return result.error;
        return { models: result.list };
    } catch (error) {
        logger.error(`Error fetching models for ${settings.provider}`, { error: error.message });
        return { models: [] };
    }
};

module.exports.generateSessionCommand = async (accountId, { sessionId, prompt, shell, rejected }) => {
    const settings = await AISettings.findOne();
    if (!isConfigured(settings)) return { code: 400, message: "AI assistant is not configured" };

    const session = SessionManager.get(sessionId);
    if (!session) return { code: 404, message: "Session not found" };
    if (session.accountId !== accountId) return { code: 403, message: "Access denied" };

    const entry = await Entry.findByPk(session.entryId);

    try {
        return await generateCommand({ settings, entry, prompt, shell, rejected });
    } catch (error) {
        logger.error("AI command generation failed", { error: error.message });
        return { code: 500, message: `Command generation failed: ${error.message}` };
    }
};
