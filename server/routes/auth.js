const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { login, logout } = require("../controllers/auth");
const { loginValidation, tokenValidation } = require("../validations/auth");
const { passkeyAuthenticationValidation, passkeyAuthOptionsValidation } = require("../validations/passkey");
const { createDeviceCodeValidation, pollDeviceCodeValidation, authorizeDeviceCodeValidation, getDeviceCodeInfoValidation } = require("../validations/deviceCode");
const { validateSchema } = require("../utils/schema");
const { generateAuthenticationOptions, verifyAuthentication } = require("../controllers/passkey");
const { createCode, pollToken, authorizeCode, getCodeInfo } = require("../controllers/deviceCode");
const { authenticate } = require("../middlewares/auth");

const app = Router();

const deviceCodeRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { code: 429, message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

/**
 * POST /auth/login
 * @summary User Authentication
 * @description Authenticates a user with username, password, and optional TOTP code. Returns a session token on success.
 * @tags Authentication
 * @produces application/json
 * @param {Login} request.body.required - User credentials including username, password, and optional totp code
 * @return {object} 200 - Session token and success message
 * @return {object} 401 - Invalid credentials or TOTP code
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
 * @description Destroys the user session associated with the provided token, logging the user out.
 * @tags Authentication
 * @produces application/json
 * @param {Logout} request.body.required - Session token to invalidate
 * @return {object} 200 - Logout success confirmation
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
 * @description Retrieves WebAuthn authentication options for passkey-based login. Used to initiate the passkey authentication flow.
 * @tags Authentication
 * @produces application/json
 * @param {PasskeyAuthOptions} request.body.required - Username and origin for passkey authentication
 * @return {object} 200 - WebAuthn authentication options
 * @return {object} 400 - User not found or passkey not configured
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
 * @description Verifies the passkey authentication response and creates a new session on success.
 * @tags Authentication
 * @produces application/json
 * @param {PasskeyVerify} request.body.required - WebAuthn authentication response
 * @return {object} 200 - Session token on successful verification
 * @return {object} 401 - Passkey verification failed
 */
app.post("/passkey/verify", async (req, res) => {
    if (validateSchema(res, passkeyAuthenticationValidation, req.body)) return;
    const result = await verifyAuthentication(req, req.body.response, { ip: req.ip, userAgent: req.header("User-Agent") || "None" }, req.body.origin);
    if (result?.code) return res.json(result);
    res.header("Authorization", result.token).json({ token: result.token, message: "Your session got successfully created" });
});

/**
 * POST /auth/device/create
 * @summary Create Device Authorization Code
 * @description Creates a new device authorization code for mobile or connector app authentication. The code can be entered on the web interface to authorize the device. Rate limited to 10 requests per hour per IP.
 * @tags Device Authentication
 * @produces application/json
 * @param {DeviceCodeCreate} request.body.required - Client type (mobile or connector)
 * @return {object} 200 - Device code and token for polling
 * @return {object} 429 - Rate limit exceeded
 */
app.post("/device/create", deviceCodeRateLimiter, async (req, res) => {
    if (validateSchema(res, createDeviceCodeValidation, req.body)) return;
    const result = await createCode({
        clientType: req.body.clientType,
        ipAddress: req.ip,
        userAgent: req.header("User-Agent") || "Unknown Device",
    });
    if (result?.code && typeof result.code === "number") return res.json(result);
    res.json(result);
});

/**
 * POST /auth/device/poll
 * @summary Poll Device Authorization Status
 * @description Polls for the authorization status of a device code. Returns pending while waiting, authorized with session token when approved, or invalid if expired/not found.
 * @tags Device Authentication
 * @produces application/json
 * @param {DeviceCodePoll} request.body.required - Device token received from create endpoint
 * @return {object} 200 - Status (pending, authorized, or invalid) and session token if authorized
 */
app.post("/device/poll", async (req, res) => {
    if (validateSchema(res, pollDeviceCodeValidation, req.body)) return;
    const result = await pollToken({ token: req.body.token });
    res.json(result);
});

/**
 * POST /auth/device/info
 * @summary Get Device Code Information
 * @description Retrieves information about a device code including client type, IP address, and user agent. Used to display device details before authorization.
 * @tags Device Authentication
 * @produces application/json
 * @security BearerAuth
 * @param {DeviceCodeInfo} request.body.required - Device code to look up
 * @return {object} 200 - Device information (clientType, ipAddress, userAgent)
 * @return {object} 404 - Device code not found or expired
 */
app.post("/device/info", authenticate, async (req, res) => {
    if (validateSchema(res, getDeviceCodeInfoValidation, req.body)) return;
    const result = await getCodeInfo({ code: req.body.code });
    if (result?.code) return res.json(result);
    res.json(result);
});

/**
 * POST /auth/device/authorize
 * @summary Authorize Device Code
 * @description Authorizes a device code, linking it to the authenticated user's session. Once authorized, the device can retrieve the session token via polling.
 * @tags Device Authentication
 * @produces application/json
 * @security BearerAuth
 * @param {DeviceCodeAuthorize} request.body.required - Device code to authorize
 * @return {object} 200 - Authorization success confirmation
 * @return {object} 404 - Device code not found or expired
 */
app.post("/device/authorize", authenticate, async (req, res) => {
    if (validateSchema(res, authorizeDeviceCodeValidation, req.body)) return;
    const result = await authorizeCode({
        code: req.body.code,
        accountId: req.user.id,
    });
    if (result?.code) return res.json(result);
    res.json(result);
});

module.exports = app;
