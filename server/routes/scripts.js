const { Router } = require("express");
const {
    getScripts,
    getScript,
    searchScripts,
    createCustomScript,
    updateCustomScript,
    deleteCustomScript,
    refreshScripts,
} = require("../controllers/script");
const { validateSchema } = require("../utils/schema");
const { scriptValidation } = require("../validations/script");

const app = Router();

app.post("/refresh", async (req, res) => {
    try {
        refreshScripts(req.user.id);
        res.json({ message: "Scripts got successfully refreshed" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/", async (req, res) => {
    try {
        if (req.query.search) {
            res.json(searchScripts(req.query.search, req.user.id));
        } else {
            res.json(getScripts(req.user.id));
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/:scriptId", async (req, res) => {
    try {
        const decodedScriptId = decodeURIComponent(req.params.scriptId);
        const script = getScript(decodedScriptId, req.user.id);
        if (!script) {
            return res.status(404).json({ code: 404, message: "Script not found" });
        }
        res.json(script);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/", async (req, res) => {
    if (validateSchema(res, scriptValidation, req.body)) return;

    try {
        const script = createCustomScript(req.user.id, req.body);
        res.status(201).json(script);
    } catch (error) {
        if (error.message === "A script with this name already exists") {
            return res.status(409).json({ code: 409, message: error.message });
        }
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.put("/:scriptId", async (req, res) => {
    if (validateSchema(res, scriptValidation, req.body)) return;

    try {
        const decodedScriptId = decodeURIComponent(req.params.scriptId);
        const script = updateCustomScript(req.user.id, decodedScriptId, req.body);
        res.json(script);
    } catch (error) {
        if (error.message === "Unauthorized to edit this script" || error.message === "Script not found") {
            return res.status(404).json({ code: 404, message: error.message });
        }
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.delete("/:scriptId", async (req, res) => {
    try {
        const decodedScriptId = decodeURIComponent(req.params.scriptId);
        deleteCustomScript(req.user.id, decodedScriptId);
        res.json({ message: "Script deleted successfully" });
    } catch (error) {
        if (error.message === "Unauthorized to delete this script" || error.message === "Script not found") {
            return res.status(404).json({ code: 404, message: error.message });
        }
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
