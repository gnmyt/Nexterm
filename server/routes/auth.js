const { Router } = require("express");
const { login, logout } = require("../controllers/auth");
const { loginValidation, tokenValidation } = require("../validations/auth");
const { validateSchema } = require("../utils/schema");

const app = Router();

/**
 * POST /auth/login
 * @summary User Authentication
 * @description Authenticates a user with username and password, optionally with TOTP code for two-factor authentication. Returns a session token that can be used for subsequent authenticated requests.
 * @tags Authentication
 * @produces application/json
 * @param {Login} request.body.required - Login credentials including username, password, and optional TOTP code
 * @return {object} 200 - Authentication successful with session token
 * @return {object} 201 - Username or password incorrect
 * @return {object} 202 - TOTP is required for this account
 * @return {object} 203 - TOTP code is invalid or has expired
 * @return {object} 403 - Internal authentication is disabled
 */
app.post("/login", async (req, res) => {
    if (validateSchema(res, loginValidation, req.body)) return;

    const session = await login(req.body, {
        ip: req.ip,
        userAgent: req.header("User-Agent") || "None",
    });
    if (session?.code) return res.json(session);

    res
        .header("Authorization", session?.token)
        .json({ ...session, message: "Your session got successfully created" });
});

/**
 * POST /auth/logout
 * @summary User Logout
 * @description Invalidates and destroys a user session by token. This endpoint is used to log out a user and clean up their session data.
 * @tags Authentication
 * @produces application/json
 * @param {Token} request.body.required - Session token to be invalidated
 * @return {object} 200 - Session successfully destroyed
 * @return {object} 204 - Session token is invalid
 */
app.post("/logout", async (req, res) => {
    if (validateSchema(res, tokenValidation, req.body)) return;

    const session = await logout(req.body.token);
    if (session) return res.json(session);

    res.json({ message: "Your session got deleted successfully" });
});

module.exports = app;
