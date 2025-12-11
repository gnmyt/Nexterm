const { Router } = require("express");
const { login, logout } = require("../controllers/auth");
const { loginValidation, tokenValidation } = require("../validations/auth");
const { passkeyAuthenticationValidation, passkeyAuthOptionsValidation } = require("../validations/passkey");
const { validateSchema } = require("../utils/schema");
const { generateAuthenticationOptions, verifyAuthentication } = require("../controllers/passkey");

const app = Router();

/**
 * POST /auth/login
 * @summary User Authentication
 * @tags Authentication
 */
app.post("/login", async (req, res) => {
    if (validateSchema(res, loginValidation, req.body)) return;
    const session = await login(req.body, { ip: req.ip, userAgent: req.header("User-Agent") || "None" });
    if (session?.code) return res.json(session);
    res.header("Authorization", session?.token).json({ ...session, message: "Your session got successfully created" });
});

/**
 * POST /auth/logout
 * @summary User Logout
 * @tags Authentication
 */
app.post("/logout", async (req, res) => {
    if (validateSchema(res, tokenValidation, req.body)) return;
    const session = await logout(req.body.token);
    if (session) return res.json(session);
    res.json({ message: "Your session got deleted successfully" });
});

/**
 * POST /auth/passkey/options
 * @summary Get Passkey Authentication Options
 * @tags Authentication
 */
app.post("/passkey/options", async (req, res) => {
    if (validateSchema(res, passkeyAuthOptionsValidation, req.body)) return;
    const result = await generateAuthenticationOptions(req, req.body.username, req.body.origin);
    if (result?.code) return res.json(result);
    res.json(result.options);
});

/**
 * POST /auth/passkey/verify
 * @summary Verify Passkey Authentication
 * @tags Authentication
 */
app.post("/passkey/verify", async (req, res) => {
    if (validateSchema(res, passkeyAuthenticationValidation, req.body)) return;
    const result = await verifyAuthentication(req, req.body.response, { ip: req.ip, userAgent: req.header("User-Agent") || "None" }, req.body.origin);
    if (result?.code) return res.json(result);
    res.header("Authorization", result.token).json({ token: result.token, message: "Your session got successfully created" });
});

module.exports = app;
