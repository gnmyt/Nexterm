const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const { sendError } = require("../utils/error");
const { createApiKey, listApiKeys, deleteApiKey } = require("../controllers/apiKey");

const app = Router();

const blockApiKeyAuth = (req, res, next) => {
    if (req.apiKey) return sendError(res, 403, 403, "API keys cannot manage API keys");
    next();
};

/**
 * GET /accounts/api-keys
 * @summary List API Keys
 * @description Lists the API keys belonging to the authenticated account. The secret token is never returned after creation.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of API keys
 */
app.get("/", authenticate, blockApiKeyAuth, async (req, res) => {
    res.json(await listApiKeys(req.user.id));
});

/**
 * POST /accounts/api-keys
 * @summary Create API Key
 * @description Creates a new API key for the authenticated account. The plaintext token is only returned once in this response.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - API key configuration (name, optional expiresAt)
 * @return {object} 200 - The created API key including the one-time token
 */
app.post("/", authenticate, blockApiKeyAuth, async (req, res) => {
    const result = await createApiKey(req.user.id, {
        name: req.body?.name,
        expiresAt: req.body?.expiresAt || null,
    });

    if (result?.code) return res.status(result.code).json({ message: result.message });

    res.json(result);
});

/**
 * DELETE /accounts/api-keys/{id}
 * @summary Delete API Key
 * @description Revokes (deletes) an API key belonging to the authenticated account.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {number} id.path.required - API key ID
 * @return {object} 200 - Deletion confirmation
 */
app.delete("/:id", authenticate, blockApiKeyAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid API key ID" });

    const result = await deleteApiKey(req.user.id, id);
    if (result?.code) return res.status(result.code).json({ message: result.message });

    res.json({ message: "API key deleted successfully" });
});

module.exports = app;
