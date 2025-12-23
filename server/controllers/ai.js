const AISettings = require("../models/AISettings");
const MonitoringSnapshot = require("../models/MonitoringSnapshot");
const logger = require("../utils/logger");

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";

const SYSTEM_PROMPT = process.env.AI_SYSTEM_PROMPT || `You are a Linux command generator assistant. Your job is to generate appropriate Linux/Unix shell commands based on user requests.

Rules:
1. Return ONLY the command(s), no explanations or markdown formatting
2. If multiple commands are needed, separate them with && or ;
3. Prefer safe, commonly available commands
4. If the request is unclear, provide the most likely intended command
5. For dangerous operations, use safer alternatives when possible
6. Always assume the user wants commands for a modern Linux system

Examples:
User: "list all files"
Response: ls -la

User: "find large files"
Response: find . -type f -size +100M -exec ls -lh {} + | sort -k5 -hr

User: "check memory usage"
Response: free -h && top -o %MEM -n 1`;

const normalizeUrl = (url) => url?.replace(/\/+$/, "") || "";

const authHeaders = (apiKey) => ({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
});

const sanitizeSettingsResponse = (settings) => {
    const response = settings.dataValues ? { ...settings.dataValues } : { ...settings };
    response.enabled = Boolean(response.enabled);
    if (response.apiKey) {
        response.hasApiKey = true;
        delete response.apiKey;
    }
    return response;
};

const getOrCreateSettings = async () => {
    let settings = await AISettings.findOne();
    if (!settings) settings = await AISettings.create({});
    return settings;
};

const buildSystemPrompt = (osInfo, recentOutput) => {
    let prompt = SYSTEM_PROMPT;

    if (osInfo) {
        const osParts = [];
        if (osInfo.hostname) osParts.push(`hostname: ${osInfo.hostname}`);
        if (osInfo.kernel) osParts.push(`kernel: ${osInfo.kernel}`);
        if (osInfo.name) osParts.push(`distro: ${osInfo.name}`);
        if (osInfo.version) osParts.push(`release: ${osInfo.version}`);
        if (osParts.length) {
            prompt += `\n\nServer info: ${osParts.join(', ')}`;
        }
    }

    if (recentOutput) {
        prompt += `\n\nRecent terminal output:\n${recentOutput}`;
    }

    return prompt;
};

const getProviderConfig = (settings) => {
    const provider = settings.provider;
    
    if (provider === "openai") {
        return {
            baseUrl: OPENAI_BASE_URL,
            headers: authHeaders(settings.apiKey),
            requiresApiKey: true,
            requiresApiUrl: false,
        };
    }
    
    if (provider === "openai_compatible") {
        return {
            baseUrl: normalizeUrl(settings.apiUrl),
            headers: authHeaders(settings.apiKey),
            requiresApiKey: true,
            requiresApiUrl: true,
        };
    }
    
    if (provider === "ollama") {
        return {
            baseUrl: normalizeUrl(settings.apiUrl) || DEFAULT_OLLAMA_URL,
            headers: { "Content-Type": "application/json" },
            requiresApiKey: false,
            requiresApiUrl: false,
        };
    }
    
    return null;
};

const validateProviderConfig = (settings, config) => {
    if (!config) return { code: 400, message: "Unsupported provider" };
    if (config.requiresApiKey && !settings.apiKey) {
        const name = settings.provider === "openai" ? "OpenAI" : "OpenAI Compatible";
        return { code: 400, message: `${name} API key not configured` };
    }
    if (config.requiresApiUrl && !settings.apiUrl) {
        return { code: 400, message: "OpenAI Compatible API URL not configured" };
    }
    return null;
};

module.exports.getAISettings = async () => {
    const settings = await getOrCreateSettings();
    return sanitizeSettingsResponse(settings);
};

module.exports.updateAISettings = async (updateData) => {
    const { enabled, provider, model, apiKey, apiUrl } = updateData;
    const settings = await getOrCreateSettings();

    const updatePayload = {};
    if (enabled !== undefined) updatePayload.enabled = enabled;
    if (provider !== undefined) updatePayload.provider = provider;
    if (model !== undefined) updatePayload.model = model;
    if (apiUrl !== undefined) updatePayload.apiUrl = apiUrl;
    if (apiKey !== undefined) updatePayload.apiKey = apiKey === "" ? null : apiKey;

    const settingsId = settings.dataValues ? settings.dataValues.id : settings.id;
    await AISettings.update(updatePayload, { where: { id: settingsId } });

    const updatedSettings = await AISettings.findOne();
    return sanitizeSettingsResponse(updatedSettings);
};

module.exports.testAIConnection = async () => {
    const settings = await AISettings.findOne();

    if (!settings || !settings.enabled) return { code: 400, message: "AI is not enabled" };
    if (!settings.provider) return { code: 400, message: "No AI provider configured" };
    if (!settings.model) return { code: 400, message: "No AI model configured" };

    const config = getProviderConfig(settings);
    const validationError = validateProviderConfig(settings, config);
    if (validationError) return validationError;

    try {
        const models = await fetchModelsForProvider(settings, config);
        if (models.error) return models.error;

        const modelExists = models.list.includes(settings.model);
        if (!modelExists) {
            const providerName = settings.provider === "ollama" ? "Ollama" : 
                                 settings.provider === "openai" ? "your OpenAI account" : "OpenAI Compatible API";
            return { code: 400, message: `Configured model "${settings.model}" not found in ${providerName}` };
        }

        return { success: true, message: "Connection test successful" };
    } catch (error) {
        logger.error("AI connection test failed", { error: error.message, stack: error.stack });
        return { code: 500, message: `Connection test failed: ${error.message}` };
    }
};

const fetchModelsForProvider = async (settings, config) => {
    const provider = settings.provider;
    
    try {
        if (provider === "ollama") {
            const response = await fetch(`${config.baseUrl}/api/tags`, {
                method: "GET",
                headers: config.headers,
            });
            
            if (!response.ok) return { error: { code: 500, message: `Ollama API error: ${response.status}` } };
            
            const data = await response.json();
            return { list: data.models?.map(m => m.name).filter(Boolean) || [] };
        }

        const response = await fetch(`${config.baseUrl}/models`, {
            headers: config.headers,
        });
        
        if (!response.ok) {
            const providerName = provider === "openai" ? "OpenAI" : "OpenAI Compatible API";
            return { error: { code: 500, message: `${providerName} error: ${response.status}` } };
        }
        
        const data = await response.json();
        let models = data.data?.map(m => m.id).filter(Boolean) || 
                     data.models?.map(m => m.name || m.id).filter(Boolean) || [];

        const excludePatterns = [
            "whisper", "tts", "dall-e", "embedding", "embed",
            "vision", "image", "audio", "speech", "moderation",
            "instruct", "edit", "search", "similarity", "code-search",
            "text-search", "realtime"
        ];
        
        models = models.filter(id => {
            const lowerId = id.toLowerCase();
            if (provider === "openai" && !lowerId.includes("gpt")) return false;
            return !excludePatterns.some(pattern => lowerId.includes(pattern));
        }).sort();
        
        return { list: models };
    } catch (error) {
        logger.error(`Error fetching models for ${provider}`, { error: error.message });
        return { list: [] };
    }
};

module.exports.getAvailableModels = async () => {
    const settings = await AISettings.findOne();

    if (!settings || !settings.provider) return { code: 400, message: "No AI provider configured" };

    const config = getProviderConfig(settings);
    const validationError = validateProviderConfig(settings, config);
    if (validationError) return validationError;

    const result = await fetchModelsForProvider(settings, config);
    if (result.error) return result.error;
    
    return { models: result.list };
};

module.exports.generateCommand = async (prompt, entryId, recentOutput) => {
    const settings = await AISettings.findOne();

    if (!settings || !settings.enabled) return { code: 400, message: "AI is not enabled" };
    if (!settings.provider || !settings.model) return { code: 400, message: "AI not properly configured" };

    let osInfo = null;
    if (entryId) {
        try {
            const snapshot = await MonitoringSnapshot.findOne({ where: { entryId } });
            if (snapshot?.osInfo) osInfo = snapshot.osInfo;
        } catch (error) {
            logger.error("Failed to fetch monitoring snapshot for AI", { entryId, error: error.message });
        }
    }

    const systemPrompt = buildSystemPrompt(osInfo, recentOutput);
    const config = getProviderConfig(settings);
    
    if (!config) return { code: 400, message: "Unsupported AI provider" };

    const command = settings.provider === "ollama"
        ? await generateOllamaCommand(prompt, settings, systemPrompt, config)
        : await generateOpenAICommand(prompt, settings, systemPrompt, config);

    return { command };
};

const generateOpenAICommand = async (prompt, settings, systemPrompt, config) => {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            max_tokens: 150,
            temperature: 0.3,
            stop: ["\n\n"],
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`API error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    return parseAIResponse(data.choices[0]?.message?.content?.trim());
};

const generateOllamaCommand = async (prompt, settings, systemPrompt, config) => {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            stream: false,
            options: {
                temperature: 0.3,
                num_predict: 150,
                stop: ["\n\n"],
            },
        }),
    });

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);

    const data = await response.json();
    return parseAIResponse(data.message?.content?.trim());
};

const parseAIResponse = (response) => {
    if (!response) return "echo 'No command generated'";

    let clean = response.replace(/```(?:bash|sh|shell)?\n?/g, "").replace(/```/g, "");

    const responseMatch = clean.match(/Response:\s*(.+?)(?:\n|$)/i);
    if (responseMatch) return responseMatch[1].trim().replace(/[\r\n]+$/, "");

    if (clean.toLowerCase().startsWith("user:")) return "echo 'Command not properly generated'";

    const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
        const cmd = lines.find(l => !l.toLowerCase().startsWith("user:") && !l.toLowerCase().startsWith("response:"));
        if (cmd) return cmd.trim().replace(/[\r\n]+$/, "");
    }

    if (clean.toLowerCase().startsWith("response:")) return "echo 'Command not properly generated'";

    return clean.trim().replace(/[\r\n]+$/, "") || "echo 'No command generated'";
};
