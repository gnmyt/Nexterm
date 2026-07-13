const AISettings = require("../models/AISettings");
const logger = require("../utils/logger");
const { getProvider, describeProviders } = require("../lib/ai/providers");

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
    anthropicAuthMethod: settings.anthropicAuthMethod,
    requireConfirmation: Boolean(settings.requireConfirmation),
    isConfigured: isConfigured(settings),
    hasApiKey: Boolean(settings.apiKey),
    subscriptionConnected: Boolean(settings.oauthRefreshToken),
});

module.exports.getRuntimeSettings = async () => AISettings.findOne();

module.exports.isConfigured = isConfigured;

module.exports.getProviders = () => ({ providers: describeProviders() });

module.exports.getAISettings = async () => {
    const settings = await AISettings.getOrCreate();
    return sanitizeSettingsResponse(settings);
};

module.exports.updateAISettings = async (updateData) => {
    const { enabled, provider, model, apiKey, apiUrl, anthropicAuthMethod, requireConfirmation } = updateData;
    const settings = await AISettings.getOrCreate();

    const payload = {};
    if (enabled !== undefined) payload.enabled = enabled;
    if (provider !== undefined) payload.provider = provider;
    if (model !== undefined) payload.model = model;
    if (apiUrl !== undefined) payload.apiUrl = apiUrl;
    if (anthropicAuthMethod !== undefined) payload.anthropicAuthMethod = anthropicAuthMethod;
    if (requireConfirmation !== undefined) payload.requireConfirmation = requireConfirmation;
    if (apiKey !== undefined) payload.apiKey = apiKey === "" ? null : apiKey;

    await AISettings.update(AISettings.encryptSecrets(payload), { where: { id: settings.id } });

    return sanitizeSettingsResponse(await AISettings.findOne());
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
    if (!settings || !settings.model) return { code: 400, message: "No AI model configured" };

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
