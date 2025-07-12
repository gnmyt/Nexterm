const { Router } = require("express");
const { isAdmin } = require("../middlewares/permission");
const { validateSchema } = require("../utils/schema");
const { updateAISettingsValidation, generateCommandValidation } = require("../validations/ai");
const {
    getAISettings,
    updateAISettings,
    testAIConnection,
    getAvailableModels,
    generateCommand
} = require("../controllers/ai");

const app = Router();

/**
 * GET /ai
 * @summary Get AI Settings
 * @description Retrieves the current AI configuration settings including API keys, models, and connection details. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - AI configuration settings
 */
app.get("/", async (req, res) => {
    try {
        const settings = await getAISettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /ai
 * @summary Update AI Settings
 * @description Updates AI configuration settings such as API keys, model selection, and connection parameters. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateAISettings} request.body.required - Updated AI configuration settings
 * @return {object} 200 - Updated AI settings
 * @return {object} 403 - Admin access required
 */
app.patch("/", isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, updateAISettingsValidation, req.body)) return;

        const updatedSettings = await updateAISettings(req.body);
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /ai/test
 * @summary Test AI Connection
 * @description Tests the connection to the configured AI service to verify settings and connectivity. Admin access required.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Connection test successful
 * @return {object} 400 - Connection test failed
 * @return {object} 403 - Admin access required
 */
app.post("/test", isAdmin, async (req, res) => {
    try {
        const result = await testAIConnection();

        if (result.code) return res.status(result.code).json({ error: result.message });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Connection test failed" });
    }
});

/**
 * GET /ai/models
 * @summary Get Available AI Models
 * @description Retrieves a list of available AI models that can be used for command generation and assistance.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of available AI models
 * @return {object} 400 - Failed to retrieve models
 */
app.get("/models", async (req, res) => {
    try {
        const result = await getAvailableModels();

        if (result.code) return res.status(result.code).json({ error: result.message });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /ai/generate
 * @summary Generate AI Command
 * @description Generates shell commands or scripts based on natural language prompts using AI assistance.
 * @tags AI
 * @produces application/json
 * @security BearerAuth
 * @param {GenerateCommand} request.body.required - Prompt text for command generation
 * @return {object} 200 - Generated command or script
 * @return {object} 400 - Failed to generate command
 */
app.post("/generate", async (req, res) => {
    try {
        if (validateSchema(res, generateCommandValidation, req.body)) return;

        const result = await generateCommand(req.body.prompt);
        if (result.code) return res.status(result.code).json({ error: result.message });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to generate command" });
    }
});

module.exports = app;
