const AISettings = require("../models/AISettings");

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

module.exports.getAISettings = async () => {
    let settings = await AISettings.findOne();

    if (!settings) settings = await AISettings.create({});
    const response = settings.dataValues ? { ...settings.dataValues } : { ...settings };

    response.enabled = Boolean(response.enabled);

    if (response.apiKey) {
        response.hasApiKey = true;
        delete response.apiKey;
    }

    return response;
};

module.exports.updateAISettings = async (updateData) => {
    const { enabled, provider, model, apiKey, apiUrl } = updateData;

    let settings = await AISettings.findOne();

    if (!settings) settings = await AISettings.create({});

    const updatePayload = {};
    if (enabled !== undefined) updatePayload.enabled = enabled;
    if (provider !== undefined) updatePayload.provider = provider;
    if (model !== undefined) updatePayload.model = model;
    if (apiUrl !== undefined) updatePayload.apiUrl = apiUrl;

    if (apiKey !== undefined) {
        updatePayload.apiKey = apiKey === "" ? null : apiKey;
    }

    const settingsId = settings.dataValues ? settings.dataValues.id : settings.id;
    await AISettings.update(updatePayload, { where: { id: settingsId } });

    const updatedSettings = await AISettings.findOne();

    const response = updatedSettings.dataValues ? { ...updatedSettings.dataValues } : { ...updatedSettings };

    response.enabled = Boolean(response.enabled);

    if (response.apiKey) {
        response.hasApiKey = true;
        delete response.apiKey;
    }

    return response;
};

module.exports.testAIConnection = async () => {
    const settings = await AISettings.findOne();

    if (!settings || !settings.enabled) return { code: 400, message: "AI is not enabled" };
    if (!settings.provider) return { code: 400, message: "No AI provider configured" };
    if (!settings.model) return { code: 400, message: "No AI model configured" };

    try {
        if (settings.provider === "openai") {
            if (!settings.apiKey) return { code: 400, message: "OpenAI API key not configured" };

            const response = await fetch("https://api.openai.com/v1/models", {
                headers: {
                    "Authorization": `Bearer ${settings.apiKey}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return { code: 500, message: `OpenAI API error: ${response.status}` };

            const data = await response.json();
            const modelExists = data.data.some(model => model.id === settings.model);

            if (!modelExists) return {
                code: 400,
                message: `Configured model "${settings.model}" not found in your OpenAI account`,
            };
        } else if (settings.provider === "ollama") {
            let ollamaUrl = settings.apiUrl || "http://localhost:11434";
            ollamaUrl = ollamaUrl.replace(/\/+$/, "");

            const response = await fetch(`${ollamaUrl}/api/tags`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return { code: 500, message: `Ollama API error: ${response.status}` };

            const data = await response.json();
            const models = data.models ? data.models.map(model => model.name) : [];

            if (!models.includes(settings.model)) return {
                code: 400,
                message: `Configured model "${settings.model}" not found in Ollama`,
            };
        } else if (settings.provider === "openai_compatible") {

		if (!settings.apiUrl) return { code: 400, message: "OpenAI Compatible API URL not configured" };
        if (!settings.apiKey) return { code: 400, message: "OpenAI Compatible API key not configured" };

            const response = await fetch(`${settings.apiUrl}/models`, {
                headers: {
                    "Authorization": `Bearer ${settings.apiKey}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return { code: 500, message: `OpenAI API error: ${response.status}` };

            const data = await response.json();
            const modelExists = data.data.some(model => model.id === settings.model);

            if (!modelExists) return {
                code: 400,
                message: `Configured model "${settings.model}" not found in OpenAI Compatible API`,
            };
        }

        return { success: true, message: "Connection test successful" };
    } catch (error) {
        console.error("AI connection test failed:", error);
        return { code: 500, message: `Connection test failed: ${error.message}` };
    }
};

module.exports.getAvailableModels = async () => {
    const settings = await AISettings.findOne();

    if (!settings || !settings.provider) return { code: 400, message: "No AI provider configured" };

    if (settings.provider === "ollama") {
        try {
            let ollamaUrl = settings.apiUrl || "http://localhost:11434";
            ollamaUrl = ollamaUrl.replace(/\/+$/, "");

            const response = await fetch(`${ollamaUrl}/api/tags`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return { code: 500, message: "Failed to fetch models from Ollama" };

            const data = await response.json();
            const ollamaModels = data.models ? data.models.map(model => model.name).filter(name => name) : [];

            return { models: ollamaModels || [] };
        } catch (error) {
            return { models: [] };
        }
    } else if (settings.provider === "openai") {
        if (!settings.apiKey) return { code: 400, message: "OpenAI API key not configured" };

        try {
            const response = await fetch("https://api.openai.com/v1/models", {
                headers: {
                    "Authorization": `Bearer ${settings.apiKey}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return { code: 500, message: "Failed to fetch models from OpenAI" };

            const data = await response.json();

            const chatModels = data.data
                .filter(model =>
                    model.id.includes("gpt") &&
                    !model.id.includes("instruct") &&
                    !model.id.includes("edit") &&
                    !model.id.includes("embedding") &&
                    !model.id.includes("whisper") &&
                    !model.id.includes("tts") &&
                    !model.id.includes("dall-e"),
                )
                .map(model => model.id)
                .sort();

            return { models: chatModels || [] };
        } catch (error) {
            console.error("Error fetching OpenAI models:", error);
            return { models: [] };
        }
    } else if (settings.provider === "openai_compatible") {
		if (!settings.apiUrl) return { code: 400, message: "OpenAI Compatible API URL not configured" };
        if (!settings.apiKey) return { code: 400, message: "OpenAI Compatible API key not configured" };

        try {
            const response = await fetch(settings.apiUrl, {
                headers: {
                    "Authorization": `Bearer ${settings.apiKey}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return { code: 500, message: "Failed to fetch models from OpenAI Compatible API" };

            const data = await response.json();

            const chatModels = data.models ? data.models.map(model => model.name).filter(name => name) : [];

            return { models: chatModels || [] };
        } catch (error) {
            console.error("Error fetching OpenAI Compatible API models:", error);
            return { models: [] };
        }
    } else {
        return { code: 400, message: "Unsupported provider" };
    }
};

module.exports.generateCommand = async (prompt) => {
    const settings = await AISettings.findOne();

    if (!settings || !settings.enabled) return { code: 400, message: "AI is not enabled" };
    if (!settings.provider || !settings.model) return { code: 400, message: "AI not properly configured" };

    let command;
    if (settings.provider === "openai") {
        command = await generateOpenAICommand(prompt, settings);
    } else if (settings.provider === "openai_compatible") {
        command = await generateOllamaCommand(prompt, settings);
    } else if (settings.provider === "ollama") {
        command = await generateOllamaCommand(prompt, settings);
    } else {
        return { code: 400, message: "Unsupported AI provider" };
    }

    return { command };
};

const generateOpenAICommand = async (prompt, settings) => {
    if (!settings.apiKey) throw new Error("OpenAI API key not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${settings.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            max_tokens: 150,
            temperature: 0.3,
            stop: ["\n\n"],
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content?.trim() || "echo 'No command generated'";
    return parseAIResponse(rawContent);
};

const generateOllamaCommand = async (prompt, settings) => {
    let ollamaUrl = settings.apiUrl || "http://localhost:11434";
    ollamaUrl = ollamaUrl.replace(/\/+$/, "");

    const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
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
    const rawContent = data.message?.content?.trim() || "echo 'No command generated'";
    return parseAIResponse(rawContent);
};

const parseAIResponse = (response) => {
    if (!response) return "echo 'No command generated'";

    let cleanResponse = response.replace(/```(?:bash|sh|shell)?\n?/g, "").replace(/```/g, "");

    const responseMatch = cleanResponse.match(/Response:\s*(.+?)(?:\n|$)/i);
    if (responseMatch) return responseMatch[1].trim().replace(/[\r\n]+$/, "");

    if (cleanResponse.toLowerCase().startsWith("user:")) {
        const userMatch = cleanResponse.match(/User:\s*["']?(.+?)["']?(?:\s*Response:|$)/i);
        if (userMatch) return "echo 'Command not properly generated'";
    }

    const lines = cleanResponse.split("\n").map(line => line.trim()).filter(line => line);

    if (lines.length > 1) {
        const commandLine = lines.find(line =>
            !line.toLowerCase().startsWith("user:") &&
            !line.toLowerCase().startsWith("response:") &&
            line.length > 0,
        );

        if (commandLine) return commandLine.trim().replace(/[\r\n]+$/, "");
    }

    if (cleanResponse.toLowerCase().startsWith("user:") ||
        cleanResponse.toLowerCase().startsWith("response:")) {
        return "echo 'Command not properly generated'";
    }

    return cleanResponse.trim().replace(/[\r\n]+$/, "") || "echo 'No command generated'";
};
