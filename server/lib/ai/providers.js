const AISettings = require("../../models/AISettings");
const { getOAuthClient, ANTHROPIC_OAUTH_BETA } = require("./oauth");
const { randomId } = require("./oauth/pkce");

const TOKEN_REFRESH_MARGIN_MS = 60_000;

const resolveAuthMethod = (provider, settings) => {
    const { apiKey, subscription } = provider.fields;
    if (subscription && !apiKey) return "subscription";
    if (apiKey && !subscription) return "api_key";
    return (settings.authMethod || "api_key") === "subscription" ? "subscription" : "api_key";
};

const subscriptionConnected = (providerId, settings) =>
    Boolean(settings.oauthRefreshToken) && settings.oauthProvider === providerId;

const normalizeUrl = (url) => {
    if (!url) return "";
    let end = url.length;
    while (end > 0 && url[end - 1] === "/") end--;
    return url.slice(0, end);
};

const CHAT_MODEL_EXCLUDE = [
    "whisper", "tts", "dall-e", "embedding", "embed", "vision", "image", "audio",
    "speech", "moderation", "edit", "search", "similarity", "text-search", "realtime", "rerank",
];
const filterChatModels = (ids) => [...new Set(ids)]
    .filter((id) => !CHAT_MODEL_EXCLUDE.some((pattern) => id.toLowerCase().includes(pattern)))
    .sort((a, b) => a.localeCompare(b));

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
        return { list: (data.models?.map((m) => m.name).filter(Boolean) || []).sort((a, b) => a.localeCompare(b)) };
    },
};

const oauthTokenAccessor = (oauthClient, settings) => {
    let cache = null;
    return async () => {
        if (cache?.accessToken && cache.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) return cache;
        cache = await oauthClient.ensureFreshToken(cache ? await AISettings.findOne() : settings);
        return cache;
    };
};

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const CLAUDE_CODE_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";
const anthropicOAuth = getOAuthClient("anthropic");

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
    const getToken = oauthTokenAccessor(anthropicOAuth, settings);

    const oauthFetch = async (input, init = {}) => {
        const { accessToken } = await getToken();
        const headers = new Headers(init.headers);
        headers.delete("x-api-key");
        headers.set("Authorization", `Bearer ${accessToken}`);
        const existingBeta = headers.get("anthropic-beta");
        headers.set("anthropic-beta", existingBeta ? `${existingBeta},${ANTHROPIC_OAUTH_BETA}` : ANTHROPIC_OAUTH_BETA);
        return fetch(input, { ...init, headers, body: prependIdentityBlock(init.body) });
    };

    const provider = createAnthropic({ apiKey: "oauth-placeholder", fetch: oauthFetch });
    return provider(settings.model);
};

const anthropicHeaders = async (settings) => {
    if (resolveAuthMethod(anthropicProvider, settings) === "subscription") {
        const { accessToken } = await anthropicOAuth.ensureFreshToken(settings);
        return {
            "Authorization": `Bearer ${accessToken}`,
            "anthropic-beta": ANTHROPIC_OAUTH_BETA,
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

const anthropicProvider = {
    id: "anthropic",
    label: "Anthropic (Claude)",
    subscriptionLabel: "Claude",
    fields: { apiKey: true, baseUrl: false, subscription: true },
    validate: (settings) => {
        if (resolveAuthMethod(anthropicProvider, settings) === "subscription") {
            return subscriptionConnected("anthropic", settings) ? null : "Claude subscription not connected";
        }
        return settings.apiKey ? null : "Anthropic API key not configured";
    },
    buildModel: (settings) => (resolveAuthMethod(anthropicProvider, settings) === "subscription"
        ? buildAnthropicSubscriptionModel(settings)
        : import("@ai-sdk/anthropic").then(({ createAnthropic }) => createAnthropic({ apiKey: settings.apiKey || "" })(settings.model))),
    listModels: async (settings) => {
        const headers = await anthropicHeaders(settings);
        const response = await fetch(`${ANTHROPIC_BASE_URL}/models?limit=1000`, { headers });
        if (!response.ok) return { error: { code: 500, message: `Anthropic API error: ${response.status}` } };
        const data = await response.json();
        return { list: (data.data?.map((m) => m.id).filter(Boolean) || []).sort((a, b) => a.localeCompare(b)) };
    },
};

const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_CLIENT_VERSION = "0.99.0";
const CODEX_USER_AGENT = `codex_cli_rs/${CODEX_CLIENT_VERSION} (Nexterm)`;
const CODEX_FALLBACK_MODELS = ["gpt-5-codex", "gpt-5", "codex-mini-latest"];
const codexOAuth = getOAuthClient("openai_codex");

const codexHeaders = (accessToken, accountId, sessionId) => {
    const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "OpenAI-Beta": "responses=experimental",
        "originator": "codex_cli_rs",
        "User-Agent": CODEX_USER_AGENT,
    };
    if (accountId) headers["ChatGPT-Account-ID"] = accountId;
    if (sessionId) headers["session-id"] = sessionId;
    return headers;
};

const rewriteCodexBody = (body) => {
    if (typeof body !== "string") return body;
    try {
        const parsed = JSON.parse(body);
        parsed.store = false;
        parsed.stream = true;
        const include = new Set(parsed.include || []);
        include.add("reasoning.encrypted_content");
        parsed.include = [...include];
        delete parsed.previous_response_id;
        if (Array.isArray(parsed.input)) {
            for (const item of parsed.input) {
                if (item && typeof item === "object" && (item.type === "message" || typeof item.role === "string")) delete item.id;
            }
        }
        return JSON.stringify(parsed);
    } catch {
        return body;
    }
};

const buildCodexModel = async (settings) => {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const getToken = oauthTokenAccessor(codexOAuth, settings);
    const sessionId = randomId();

    const codexFetch = async (input, init = {}) => {
        const { accessToken, accountId } = await getToken();
        const headers = new Headers(init.headers);
        for (const [key, value] of Object.entries(codexHeaders(accessToken, accountId, sessionId))) {
            headers.set(key, value);
        }
        headers.set("Accept", "text/event-stream");
        return fetch(input, { ...init, headers, body: rewriteCodexBody(init.body) });
    };

    const provider = createOpenAI({ baseURL: CODEX_BASE_URL, apiKey: "oauth-placeholder", fetch: codexFetch });
    return provider.responses(settings.model);
};

const codexProvider = {
    id: "openai_codex",
    label: "OpenAI (Codex / ChatGPT)",
    subscriptionLabel: "ChatGPT",
    fields: { apiKey: false, baseUrl: false, subscription: true },
    validate: (settings) => (subscriptionConnected("openai_codex", settings) ? null : "ChatGPT subscription not connected"),
    buildModel: (settings) => buildCodexModel(settings),
    listModels: async (settings) => {
        try {
            const { accessToken, accountId } = await codexOAuth.ensureFreshToken(settings);
            const response = await fetch(`${CODEX_BASE_URL}/models?client_version=${CODEX_CLIENT_VERSION}`, {
                headers: codexHeaders(accessToken, accountId),
            });
            if (response.ok) {
                const data = await response.json();
                const slugs = (data.models || data.data || []).map((m) => m.slug || m.id).filter(Boolean);
                if (slugs.length) return { list: [...new Set(slugs)].sort((a, b) => a.localeCompare(b)) };
            }
        } catch {}
        return { list: CODEX_FALLBACK_MODELS };
    },
};

const REGISTRY = {
    openai: compatibleProvider({ id: "openai", label: "OpenAI", fixedBaseUrl: "https://api.openai.com/v1" }),
    openai_codex: codexProvider,
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

const ORDER = ["openai", "openai_codex", "anthropic", "google", "groq", "mistral", "deepseek", "xai", "openrouter", "openai_compatible", "ollama"];

const getProvider = (id) => REGISTRY[id] || null;
const providerIds = () => [...ORDER];

const describeProviders = () => ORDER.map((id) => {
    const provider = REGISTRY[id];
    return {
        id: provider.id,
        label: provider.label,
        subscriptionLabel: provider.subscriptionLabel || provider.label,
        fields: provider.fields,
    };
});

const buildModel = (settings) => {
    const provider = getProvider(settings.provider);
    if (!provider) throw new Error(`Unsupported AI provider: ${settings.provider}`);
    return provider.buildModel(settings);
};

const supportsSubscription = (providerId) => Boolean(getProvider(providerId)?.fields?.subscription);

const getProviderOAuth = (providerId) => (supportsSubscription(providerId) ? getOAuthClient(providerId) : null);

const isSubscriptionConnected = (settings) =>
    Boolean(settings?.provider) && subscriptionConnected(settings.provider, settings);

const getModelProviderOptions = (settings) => {
    if (settings?.provider === "openai_codex") return { openai: { store: false } };
    return undefined;
};

module.exports = {
    getProvider, providerIds, describeProviders, buildModel,
    supportsSubscription, getProviderOAuth, isSubscriptionConnected,
    getModelProviderOptions,
};
