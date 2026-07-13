const AISettings = require("../../models/AISettings");
const { ensureFreshToken, OAUTH_BETA, buildHeaders: buildAnthropicHeaders } = require("./anthropicOAuth");

const normalizeUrl = (url) => url?.replace(/\/+$/, "") || "";

const CHAT_MODEL_EXCLUDE = [
    "whisper", "tts", "dall-e", "embedding", "embed", "vision", "image", "audio",
    "speech", "moderation", "edit", "search", "similarity", "text-search", "realtime", "rerank",
];
const filterChatModels = (ids) => [...new Set(ids)]
    .filter((id) => !CHAT_MODEL_EXCLUDE.some((pattern) => id.toLowerCase().includes(pattern)))
    .sort();

const fetchOpenAICompatibleModels = async (baseUrl, apiKey) => {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const response = await fetch(`${normalizeUrl(baseUrl)}/models`, { headers });
    if (!response.ok) return { error: { code: 500, message: `Provider API error: ${response.status}` } };
    const data = await response.json();
    const ids = data.data?.map((m) => m.id).filter(Boolean)
        || data.models?.map((m) => m.name || m.id).filter(Boolean) || [];
    return { list: filterChatModels(ids) };
};

const buildOpenAICompatibleModel = async (name, baseUrl, apiKey, model) => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const provider = createOpenAICompatible({ name, baseURL: normalizeUrl(baseUrl), apiKey: apiKey || "" });
    return provider(model);
};

const compatibleProvider = ({ id, label, fixedBaseUrl, userBaseUrl = false, requiresApiKey = true, defaultBaseUrl = "" }) => {
    const resolveBaseUrl = (settings) => (userBaseUrl ? normalizeUrl(settings.apiUrl) || defaultBaseUrl : fixedBaseUrl);
    return {
        id,
        label,
        fields: { apiKey: requiresApiKey, baseUrl: userBaseUrl ? { default: defaultBaseUrl } : false, subscription: false },
        validate: (settings) => {
            if (userBaseUrl && !resolveBaseUrl(settings)) return `${label} base URL not configured`;
            if (requiresApiKey && !settings.apiKey) return `${label} API key not configured`;
            return null;
        },
        buildModel: (settings) => buildOpenAICompatibleModel(id, resolveBaseUrl(settings), settings.apiKey, settings.model),
        listModels: (settings) => fetchOpenAICompatibleModels(resolveBaseUrl(settings), settings.apiKey),
    };
};

const OLLAMA_DEFAULT_URL = "http://localhost:11434";
const ollamaBaseUrl = (settings) => normalizeUrl(settings.apiUrl) || OLLAMA_DEFAULT_URL;
const ollamaProvider = {
    id: "ollama",
    label: "Ollama",
    fields: { apiKey: false, baseUrl: { default: OLLAMA_DEFAULT_URL }, subscription: false },
    validate: (settings) => (ollamaBaseUrl(settings) ? null : "Ollama URL not configured"),
    buildModel: (settings) => buildOpenAICompatibleModel("ollama", `${ollamaBaseUrl(settings)}/v1`, "", settings.model),
    listModels: async (settings) => {
        const response = await fetch(`${ollamaBaseUrl(settings)}/api/tags`, { headers: { "Content-Type": "application/json" } });
        if (!response.ok) return { error: { code: 500, message: `Ollama API error: ${response.status}` } };
        const data = await response.json();
        return { list: (data.models?.map((m) => m.name).filter(Boolean) || []).sort() };
    },
};

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const CLAUDE_CODE_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";

const prependIdentityBlock = (body) => {
    if (typeof body !== "string") return body;
    try {
        const parsed = JSON.parse(body);
        const idBlock = { type: "text", text: CLAUDE_CODE_IDENTITY };
        if (Array.isArray(parsed.system)) parsed.system = [idBlock, ...parsed.system];
        else if (typeof parsed.system === "string") parsed.system = [idBlock, { type: "text", text: parsed.system }];
        else parsed.system = [idBlock];
        return JSON.stringify(parsed);
    } catch {
        return body;
    }
};

const buildAnthropicSubscriptionModel = async (settings) => {
    const { createAnthropic } = await import("@ai-sdk/anthropic");

    let tokenCache = await ensureFreshToken(settings);
    const getAccessToken = async () => {
        if (tokenCache.accessToken && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
        tokenCache = await ensureFreshToken(await AISettings.findOne());
        return tokenCache.accessToken;
    };

    const oauthFetch = async (input, init = {}) => {
        const accessToken = await getAccessToken();
        const headers = new Headers(init.headers);
        headers.delete("x-api-key");
        headers.set("Authorization", `Bearer ${accessToken}`);
        const existingBeta = headers.get("anthropic-beta");
        headers.set("anthropic-beta", existingBeta ? `${existingBeta},${OAUTH_BETA}` : OAUTH_BETA);
        return fetch(input, { ...init, headers, body: prependIdentityBlock(init.body) });
    };

    const provider = createAnthropic({ apiKey: "oauth-placeholder", fetch: oauthFetch });
    return provider(settings.model);
};

const buildAnthropicApiKeyModel = async (settings) => {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const provider = createAnthropic({ apiKey: settings.apiKey || "" });
    return provider(settings.model);
};

const isAnthropicSubscription = (settings) => (settings.anthropicAuthMethod || "api_key") === "subscription";

const anthropicProvider = {
    id: "anthropic",
    label: "Anthropic (Claude)",
    fields: { apiKey: true, baseUrl: false, subscription: true },
    validate: (settings) => {
        if (isAnthropicSubscription(settings)) return settings.oauthRefreshToken ? null : "Claude subscription not connected";
        return settings.apiKey ? null : "Anthropic API key not configured";
    },
    buildModel: (settings) => (isAnthropicSubscription(settings)
        ? buildAnthropicSubscriptionModel(settings)
        : buildAnthropicApiKeyModel(settings)),
    listModels: async (settings) => {
        const headers = await buildAnthropicHeaders(settings);
        const response = await fetch(`${ANTHROPIC_BASE_URL}/models?limit=1000`, { headers });
        if (!response.ok) return { error: { code: 500, message: `Anthropic API error: ${response.status}` } };
        const data = await response.json();
        return { list: (data.data?.map((m) => m.id).filter(Boolean) || []).sort() };
    },
};

const REGISTRY = {
    openai: compatibleProvider({ id: "openai", label: "OpenAI", fixedBaseUrl: "https://api.openai.com/v1" }),
    anthropic: anthropicProvider,
    google: compatibleProvider({ id: "google", label: "Google Gemini", fixedBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" }),
    groq: compatibleProvider({ id: "groq", label: "Groq", fixedBaseUrl: "https://api.groq.com/openai/v1" }),
    mistral: compatibleProvider({ id: "mistral", label: "Mistral", fixedBaseUrl: "https://api.mistral.ai/v1" }),
    deepseek: compatibleProvider({ id: "deepseek", label: "DeepSeek", fixedBaseUrl: "https://api.deepseek.com/v1" }),
    xai: compatibleProvider({ id: "xai", label: "xAI (Grok)", fixedBaseUrl: "https://api.x.ai/v1" }),
    openrouter: compatibleProvider({ id: "openrouter", label: "OpenRouter", fixedBaseUrl: "https://openrouter.ai/api/v1" }),
    openai_compatible: compatibleProvider({ id: "openai_compatible", label: "OpenAI Compatible", userBaseUrl: true }),
    ollama: ollamaProvider,
};

const ORDER = ["openai", "anthropic", "google", "groq", "mistral", "deepseek", "xai", "openrouter", "openai_compatible", "ollama"];

const getProvider = (id) => REGISTRY[id] || null;
const providerIds = () => [...ORDER];

const describeProviders = () => ORDER.map((id) => {
    const provider = REGISTRY[id];
    return { id: provider.id, label: provider.label, fields: provider.fields };
});

const buildModel = (settings) => {
    const provider = getProvider(settings.provider);
    if (!provider) throw new Error(`Unsupported AI provider: ${settings.provider}`);
    return provider.buildModel(settings);
};

module.exports = { getProvider, providerIds, describeProviders, buildModel };
