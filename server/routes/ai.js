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
app.get("/", isAdmin, async (req, res) => {
    try {
        const settings = await getAISettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.patch("/", isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, updateAISettingsValidation, req.body)) return;

        const updatedSettings = await updateAISettings(req.body);
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/test", isAdmin, async (req, res) => {
    try {
        const result = await testAIConnection();

        if (result.code) return res.status(result.code).json({ error: result.message });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Connection test failed" });
    }
});

app.get("/models", async (req, res) => {
    try {
        const result = await getAvailableModels();

        if (result.code) return res.status(result.code).json({ error: result.message });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

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
