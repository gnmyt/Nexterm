const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { createApiKeyValidation } = require("../validations/apiKey");
const { authenticate } = require("../middlewares/auth");
const { sendError } = require("../utils/error");
const { createApiKey, listApiKeys, deleteApiKey } = require("../controllers/apiKey");

const app = Router();

const blockApiKeyAuth = (req, res, next) => {
    if (req.apiKey) return sendError(res, 403, 403, "API keys cannot manage API keys");
    next();
};

app.get("/", authenticate, blockApiKeyAuth, route({
    summary: "List API keys",
    description: "Lists the API keys belonging to the authenticated account. The secret token is never returned after creation.",
    returns: objectList,
}), async (req, res) => {
    res.json(await listApiKeys(req.user.id));
});

app.post("/", authenticate, blockApiKeyAuth, route({
    summary: "Create API key",
    description: "Creates a new API key for the authenticated account. The plaintext token is only returned once in this response.",
    body: createApiKeyValidation,
}), async (req, res) => {
    const result = await createApiKey(req.user.id, { name: req.body.name, expiresAt: req.body.expiresAt || null });

    if (result?.code) return res.status(result.code).json({ message: result.message });

    res.json(result);
});

app.delete("/:id", authenticate, blockApiKeyAuth, route({
    summary: "Delete API key",
    description: "Revokes (deletes) an API key belonging to the authenticated account.",
}), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid API key ID" });

    const result = await deleteApiKey(req.user.id, id);
    if (result?.code) return res.status(result.code).json({ message: result.message });

    res.json({ message: "API key deleted successfully" });
});

module.exports = app;
