const { Router } = require("express");
const { registerValidation, totpSetup, passwordChangeValidation, updateNameValidation } = require("../validations/account");
const { createAccount, updateTOTP, updatePassword, updateName } = require("../controllers/account");
const speakeasy = require("speakeasy");
const { authenticate } = require("../middlewares/auth");
const { validateSchema } = require("../utils/schema");
const { sendError } = require("../utils/error");

const app = Router();

app.get("/me", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    res.json({
        id: req.user.id, username: req.user.username, totpEnabled: req.user.totpEnabled,
        firstName: req.user.firstName, lastName: req.user.lastName,
    });
});

app.patch("/password", authenticate, async (req, res) => {
    if (validateSchema(res, passwordChangeValidation, req.body)) return;

    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    await updatePassword(req.user.id, req.body.password);

    res.json({ message: "Your password has been successfully updated." });
});

app.patch("/name", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    if (validateSchema(res, updateNameValidation, req.body)) return;

    await updateName(req.user.id, req.body);

    res.json({ message: "Your name has been successfully updated." });
});

app.post("/register", async (req, res) => {
    if (validateSchema(res, registerValidation, req.body)) return;

    const account = await createAccount(req.body);
    if (account) return res.json(account);

    res.json({ message: "Your account has been successfully created." });
});

app.get("/totp/secret", authenticate, async (req, res) => {
    res.json({
        secret: req.user?.totpSecret,
        url: `otpauth://totp/Nexterm%20%28${req.user?.username}%29?secret=${req.user?.totpSecret}`,
    });
});

app.post("/totp/enable", authenticate, async (req, res) => {
    if (validateSchema(res, totpSetup, req.body)) return;

    const tokenCorrect = speakeasy.totp.verify({
        secret: req.user?.totpSecret || "",
        encoding: "base32",
        token: req.body.code,
    });

    if (!tokenCorrect)
        return sendError(res, 400, 203, "Your provided code is invalid or has expired.");

    const enabledError = await updateTOTP(req.user?.id, true);
    if (enabledError) return res.json(enabledError);

    res.json({ message: "TOTP has been successfully enabled on your account." });
});

app.post("/totp/disable", authenticate, async (req, res) => {
    const enabledError = await updateTOTP(req.user.id, false);
    if (enabledError) return res.json(enabledError);

    res.json({ message: "TOTP has been successfully disabled on your account." });
});

module.exports = app;