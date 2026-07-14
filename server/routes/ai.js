const { Router } = require("express");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");
const { validateSchema } = require("../utils/schema");
const { updateAISettingsValidation, oauthExchangeValidation } = require("../validations/ai");
const {
    getAISettings,
    updateAISettings,
    testAIConnection,
    getAvailableModels,
    getProviders,
} = require("../controllers/ai");
const { generateAuthUrl, exchangeCode, disconnect } = require("../lib/ai/anthropicOAuth");

const app = Router();

/**
 * GET /ai
 * @summary Get AI Settings
 * @description Retrieves the current AI assistant configuration.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - AI configuration settings
 */
app.get("/", async (req, res) => {
    try {
        res.json(await getAISettings());
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /ai
 * @summary Update AI Settings
 * @description Updates the AI assistant configuration. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateAISettings} request.body.required - Updated AI configuration settings
 * @return {object} 200 - Updated AI settings
 * @return {object} 403 - Admin access required
 */
app.patch("/", requirePermission(Permission.SETTINGS_AI), async (req, res) => {
    try {
        if (validateSchema(res, updateAISettingsValidation, req.body)) return;
        res.json(await updateAISettings(req.body));
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /ai/test
 * @summary Test AI Connection
 * @description Verifies connectivity to the configured AI provider. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Connection test successful
 * @return {object} 400 - Connection test failed
 * @return {object} 403 - Admin access required
 */
app.post("/test", requirePermission(Permission.SETTINGS_AI), async (req, res) => {
    try {
        const result = await testAIConnection();
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Connection test failed" });
    }
});

/**
 * GET /ai/providers
 * @summary List Supported AI Providers
 * @description Returns the available AI providers and the fields each one requires, for rendering the settings form.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Supported providers
 */
app.get("/providers", async (req, res) => {
    try {
        res.json(getProviders());
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /ai/models
 * @summary Get Available AI Models
 * @description Retrieves the list of models available from the configured provider. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of available AI models
 * @return {object} 400 - Failed to retrieve models
 * @return {object} 403 - Admin access required
 */
app.get("/models", requirePermission(Permission.SETTINGS_AI), async (req, res) => {
    try {
        const result = await getAvailableModels();
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /ai/oauth/start
 * @summary Start Claude Subscription OAuth
 * @description Generates the Anthropic authorization URL for connecting a Claude Pro/Max subscription. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Authorization URL
 * @return {object} 403 - Admin access required
 */
app.post("/oauth/start", requirePermission(Permission.SETTINGS_AI), async (req, res) => {
    try {
        const authUrl = await generateAuthUrl();
        res.json({ authUrl });
    } catch {
        res.status(500).json({ error: "Failed to start authorization" });
    }
});

/**
 * POST /ai/oauth/exchange
 * @summary Complete Claude Subscription OAuth
 * @description Exchanges the authorization code for tokens and stores the connected subscription. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @param {OAuthExchange} request.body.required - The authorization code
 * @return {object} 200 - Subscription connected
 * @return {object} 400 - Exchange failed
 * @return {object} 403 - Admin access required
 */
app.post("/oauth/exchange", requirePermission(Permission.SETTINGS_AI), async (req, res) => {
    try {
        if (validateSchema(res, oauthExchangeValidation, req.body)) return;
        const result = await exchangeCode(req.body.code);
        if (result.code) return res.status(result.code).json({ error: result.message });
        res.json(result);
    } catch {
        res.status(500).json({ error: "Failed to complete authorization" });
    }
});

/**
 * POST /ai/oauth/disconnect
 * @summary Disconnect Claude Subscription
 * @description Removes the stored Claude subscription tokens. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Subscription disconnected
 * @return {object} 403 - Admin access required
 */
app.post("/oauth/disconnect", requirePermission(Permission.SETTINGS_AI), async (req, res) => {
    try {
        res.json(await disconnect());
    } catch {
        res.status(500).json({ error: "Failed to disconnect" });
    }
});

module.exports = app;
