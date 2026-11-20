const { Router } = require("express");
const { route } = require("../utils/route");
const { authenticate } = require("../middlewares/auth");
const { sendError } = require("../utils/error");
const { passkeyRenameValidation, passkeyRegistrationValidation, passkeyRegistrationOptionsValidation } = require("../validations/passkey");
const { generateRegistrationOptions, verifyRegistration, listPasskeys, deletePasskey, renamePasskey } = require("../controllers/passkey");

const app = Router();

app.get("/", authenticate, route({
    summary: "List passkeys",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    res.json(await listPasskeys(req.user.id));
});

app.post("/register/options", authenticate, route({
    summary: "Get passkey registration options",
    body: passkeyRegistrationOptionsValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    const options = await generateRegistrationOptions(req, req.user.id, req.body.origin);
    res.json(options);
});

app.post("/register/verify", authenticate, route({
    summary: "Verify passkey registration",
    body: passkeyRegistrationValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    const result = await verifyRegistration(req, req.user.id, req.body.response, req.body.name, req.body.origin);
    if (result?.code) return res.json(result);
    res.json({ message: "Passkey registered successfully", verified: true });
});

app.delete("/:id", authenticate, route({
    summary: "Delete passkey",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    const passkeyId = parseInt(req.params.id, 10);
    if (isNaN(passkeyId)) return sendError(res, 400, 309, "Invalid passkey ID");
    const result = await deletePasskey(req.user.id, passkeyId);
    if (result?.code) return res.json(result);
    res.json({ message: "Passkey deleted successfully" });
});

app.patch("/:id", authenticate, route({
    summary: "Rename passkey",
    body: passkeyRenameValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    const passkeyId = parseInt(req.params.id, 10);
    if (isNaN(passkeyId)) return sendError(res, 400, 309, "Invalid passkey ID");
    const result = await renamePasskey(req.user.id, passkeyId, req.body.name);
    if (result?.code) return res.json(result);
    res.json({ message: "Passkey renamed successfully" });
});

module.exports = app;
