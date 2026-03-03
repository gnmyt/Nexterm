const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const { validateSchema } = require("../utils/schema");
const { sendError } = require("../utils/error");
const { passkeyRenameValidation, passkeyRegistrationValidation } = require("../validations/passkey");
const { generateRegistrationOptions, verifyRegistration, listPasskeys, deletePasskey, renamePasskey } = require("../controllers/passkey");

const app = Router();

/**
 * GET /account/passkeys
 * @summary List Passkeys
 * @tags Account
 * @security BearerAuth
 */
app.get("/", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    res.json(await listPasskeys(req.user.id));
});

/**
 * POST /account/passkeys/register/options
 * @summary Get Passkey Registration Options
 * @tags Account
 * @security BearerAuth
 */
app.post("/register/options", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    const options = await generateRegistrationOptions(req, req.user.id, req.body.origin);
    res.json(options);
});

/**
 * POST /account/passkeys/register/verify
 * @summary Verify Passkey Registration
 * @tags Account
 * @security BearerAuth
 */
app.post("/register/verify", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    if (validateSchema(res, passkeyRegistrationValidation, req.body)) return;
    const result = await verifyRegistration(req, req.user.id, req.body.response, req.body.name, req.body.origin);
    if (result?.code) return res.json(result);
    res.json({ message: "Passkey registered successfully", verified: true });
});

/**
 * DELETE /account/passkeys/:id
 * @summary Delete Passkey
 * @tags Account
 * @security BearerAuth
 */
app.delete("/:id", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    const passkeyId = parseInt(req.params.id, 10);
    if (isNaN(passkeyId)) return sendError(res, 400, 309, "Invalid passkey ID");
    const result = await deletePasskey(req.user.id, passkeyId);
    if (result?.code) return res.json(result);
    res.json({ message: "Passkey deleted successfully" });
});

/**
 * PATCH /account/passkeys/:id
 * @summary Rename Passkey
 * @tags Account
 * @security BearerAuth
 */
app.patch("/:id", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    if (validateSchema(res, passkeyRenameValidation, req.body)) return;
    const passkeyId = parseInt(req.params.id, 10);
    if (isNaN(passkeyId)) return sendError(res, 400, 309, "Invalid passkey ID");
    const result = await renamePasskey(req.user.id, passkeyId, req.body.name);
    if (result?.code) return res.json(result);
    res.json({ message: "Passkey renamed successfully" });
});

module.exports = app;
