const { Router } = require("express");
const { route } = require("../utils/route");
const rateLimit = require("express-rate-limit");
const { login, logout } = require("../controllers/auth");
const { loginValidation, tokenValidation } = require("../validations/auth");
const { passkeyAuthenticationValidation, passkeyAuthOptionsValidation } = require("../validations/passkey");
const { createDeviceCodeValidation, pollDeviceCodeValidation, authorizeDeviceCodeValidation, getDeviceCodeInfoValidation, checkLinkStatusValidation } = require("../validations/deviceCode");
const { generateAuthenticationOptions, verifyAuthentication } = require("../controllers/passkey");
const { createCode, pollToken, authorizeCode, getCodeInfo, checkLinkStatus } = require("../controllers/deviceCode");
const { authenticate } = require("../middlewares/auth");
const { createGuestSession, removeGuestByToken } = require("../controllers/demo");
const { isDemoMode, DEMO_SETTINGS } = require("../utils/demoMode");
const { findActiveSession } = require("../utils/loginSession");
const Account = require("../models/Account");

const optionalAuth = async (req, res, next) => {
    const authHeader = req.header("authorization");
    if (!authHeader) return next();
    const parts = authHeader.split(" ");
    if (parts.length !== 2) return next();
    try {
        const session = await findActiveSession(parts[1]);
        if (session) {
            req.session = session;
            req.user = await Account.findByPk(session.accountId);
        }
    } catch (_) {}
    next();
};

const app = Router();

const deviceCodeRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    skip: (req) => !!req.user,
    message: { code: 429, message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { code: 429, message: "Too many authentication attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post("/login", authRateLimiter, route({
    summary: "User authentication",
    description: "Authenticates a user with username, password, and optional TOTP code. Returns a session token on success.",
    body: loginValidation,
}), async (req, res) => {
    const session = await login(req.body, { ip: req.ip, userAgent: req.header("User-Agent") || "None" });
    if (session?.code) return res.json(session);
    res.header("Authorization", session?.token).json({ ...session, message: "Your session got successfully created" });
});

const demoGuestRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: DEMO_SETTINGS.guestsPerIpPerHour,
    message: { code: 429, message: "Too many demo sessions from your network. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post("/demo", (req, res, next) => isDemoMode() ? next() : res.status(404).json({ code: 404, message: "Demo mode is not enabled" }),
    demoGuestRateLimiter, route({
        summary: "Start demo session",
        description: "Creates a temporary guest account and returns its session token. Only available when the server runs in demo mode. Guest accounts and everything they created are removed once they expire.",
    }), async (req, res) => {
        const result = await createGuestSession({ ip: req.ip, userAgent: req.header("User-Agent") || "None" });
        if (result.code) return res.status(result.code).json(result);
        res.json(result);
    });

app.post("/logout", route({
    summary: "User logout",
    description: "Destroys the user session associated with the provided token, logging the user out.",
    body: tokenValidation,
}), async (req, res) => {
    await removeGuestByToken(req.body.token);
    const session = await logout(req.body.token);
    if (session) return res.json(session);
    res.json({ message: "Your session got deleted successfully" });
});

app.post("/passkey/options", authRateLimiter, route({
    summary: "Get passkey authentication options",
    description: "Retrieves WebAuthn authentication options for passkey-based login. Used to initiate the passkey authentication flow.",
    body: passkeyAuthOptionsValidation,
}), async (req, res) => {
    const result = await generateAuthenticationOptions(req, req.body.username, req.body.origin);
    if (result?.code) return res.json(result);
    res.json(result.options);
});

app.post("/passkey/verify", authRateLimiter, route({
    summary: "Verify passkey authentication",
    description: "Verifies the passkey authentication response and creates a new session on success.",
    body: passkeyAuthenticationValidation,
}), async (req, res) => {
    const result = await verifyAuthentication(req, req.body.response, { ip: req.ip, userAgent: req.header("User-Agent") || "None" }, req.body.origin);
    if (result?.code) return res.json(result);
    res.header("Authorization", result.token).json({ token: result.token, message: "Your session got successfully created" });
});

app.post("/device/create", optionalAuth, deviceCodeRateLimiter, route({
    summary: "Create device authorization code",
    description: "Creates a new device authorization code for mobile or connector app authentication. The code can be entered on the web interface to authorize the device. Rate limited to 10 requests per hour per IP.",
    tag: "Device authentication",
    body: createDeviceCodeValidation,
}), async (req, res) => {
    const result = await createCode({
        clientType: req.body.clientType,
        ipAddress: req.ip,
        userAgent: req.header("User-Agent") || "Unknown Device",
    });
    if (result?.code && typeof result.code === "number") return res.json(result);
    res.json(result);
});

app.post("/device/poll", route({
    summary: "Poll device authorization status",
    description: "Polls for the authorization status of a device code. Returns pending while waiting, authorized with session token when approved, or invalid if expired/not found.",
    tag: "Device authentication",
    body: pollDeviceCodeValidation,
}), async (req, res) => {
    const result = await pollToken({ token: req.body.token });
    res.json(result);
});

app.post("/device/info", authenticate, route({
    summary: "Get device code information",
    description: "Retrieves information about a device code including client type, IP address, and user agent. Used to display device details before authorization.",
    tag: "Device authentication",
    body: getDeviceCodeInfoValidation,
}), async (req, res) => {
    const result = await getCodeInfo({ code: req.body.code });
    if (result?.code) return res.json(result);
    res.json(result);
});

app.post("/device/authorize", authenticate, route({
    summary: "Authorize device code",
    description: "Authorizes a device code, linking it to the authenticated user's session. Once authorized, the device can retrieve the session token via polling.",
    tag: "Device authentication",
    body: authorizeDeviceCodeValidation,
}), async (req, res) => {
    const result = await authorizeCode({
        code: req.body.code,
        accountId: req.user.id,
    });
    if (result?.code) return res.json(result);
    res.json(result);
});

app.post("/device/link/status", authenticate, route({
    summary: "Check device link status",
    description: "Checks whether a device code created for QR linking has been claimed by the mobile app. Returns claimed when the phone has polled and received the session token.",
    tag: "Device authentication",
    body: checkLinkStatusValidation,
}), async (req, res) => {
    const result = await checkLinkStatus({ code: req.body.code });
    res.json(result);
});

module.exports = app;
