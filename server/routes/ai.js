const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { requirePermission } = require("../middlewares/permission");
const { isDemoGuest } = require("../utils/demoMode");
const { Permission } = require("../permissions/registry");
const { updateAISettingsValidation, oauthExchangeValidation, oauthProviderValidation, generateCommandValidation } = require("../validations/ai");
const {
    getAISettings,
    updateAISettings,
    testAIConnection,
    getAvailableModels,
    getProviders,
    startOAuth,
    exchangeOAuth,
    disconnectOAuth,
    generateSessionCommand,
} = require("../controllers/ai");

const app = Router();

app.get("/", route({
    summary: "Get AI settings",
    description: "Retrieves the current AI assistant configuration.",
}), async (req, res) => {
    try {
        const settings = await getAISettings();
        if (isDemoGuest(req.user)) return res.json({ ...settings, enabled: false });
        res.json(settings);
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.patch("/", requirePermission(Permission.SETTINGS_AI), route({
    summary: "Update AI settings",
    description: "Updates the AI assistant configuration.",
    body: updateAISettingsValidation,
}), async (req, res) => {
    try {
        res.json(await updateAISettings(req.body));
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/test", requirePermission(Permission.SETTINGS_AI), route({
    summary: "Test AI connection",
    description: "Verifies connectivity to the configured AI provider.",
}), async (req, res) => {
    try {
        const result = await testAIConnection();
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Connection test failed" });
    }
});

app.post("/command", route({
    summary: "Generate a terminal command",
    description: "Turns a natural language request into shell command suggestions for the given session, without executing any of them.",
    body: generateCommandValidation,
}), async (req, res) => {
    try {
        const result = await generateSessionCommand(req.user.id, req.body);
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/providers", route({
    summary: "List supported AI providers",
    description: "Returns the available AI providers and the fields each one requires, for rendering the settings form.",
}), async (req, res) => {
    try {
        res.json(getProviders());
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/models", requirePermission(Permission.SETTINGS_AI), route({
    summary: "Get available AI models",
    description: "Retrieves the list of models available from the configured provider.",
    returns: objectList,
}), async (req, res) => {
    try {
        const result = await getAvailableModels();
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/oauth/start", requirePermission(Permission.SETTINGS_AI), route({
    summary: "Start subscription OAuth",
    description: "Generates the authorization URL for connecting a provider subscription (e.g. Claude Pro/Max or ChatGPT Plus/Pro).",
    body: oauthProviderValidation,
}), async (req, res) => {
    try {
        const result = await startOAuth(req.body.provider);
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Failed to start authorization" });
    }
});

app.post("/oauth/exchange", requirePermission(Permission.SETTINGS_AI), route({
    summary: "Complete subscription OAuth",
    description: "Exchanges the authorization code for tokens and stores the connected subscription.",
    body: oauthExchangeValidation,
}), async (req, res) => {
    try {
        const result = await exchangeOAuth(req.body.code, req.body.provider);
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Failed to complete authorization" });
    }
});

app.post("/oauth/disconnect", requirePermission(Permission.SETTINGS_AI), route({
    summary: "Disconnect subscription",
    description: "Removes the stored subscription tokens.",
    body: oauthProviderValidation,
}), async (req, res) => {
    try {
        const result = await disconnectOAuth(req.body.provider);
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Failed to disconnect" });
    }
});

module.exports = app;
