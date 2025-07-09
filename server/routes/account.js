const { Router } = require("express");
const { registerValidation, totpSetup, passwordChangeValidation, updateNameValidation } = require("../validations/account");
const { createAccount, updateTOTP, updatePassword, updateName } = require("../controllers/account");
const speakeasy = require("speakeasy");
const { authenticate } = require("../middlewares/auth");
const { validateSchema } = require("../utils/schema");
const { sendError } = require("../utils/error");

const app = Router();

/**
 * GET /account/me
 * @summary Get Current User Information
 * @description Retrieves the authenticated user's profile information including username, TOTP status, name, and role.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - User profile information
 * @return {object} 401 - User is not authenticated
 */
app.get("/me", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    res.json({
        id: req.user.id, username: req.user.username, totpEnabled: req.user.totpEnabled,
        firstName: req.user.firstName, lastName: req.user.lastName, role: req.user.role,
    });
});

/**
 * PATCH /account/password
 * @summary Update Password
 * @description Updates the authenticated user's password. Requires current authentication.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {PasswordChange} request.body.required - New password information
 * @return {object} 200 - Password successfully updated
 * @return {object} 401 - User is not authenticated
 */
app.patch("/password", authenticate, async (req, res) => {
    if (validateSchema(res, passwordChangeValidation, req.body)) return;

    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    await updatePassword(req.user.id, req.body.password);

    res.json({ message: "Your password has been successfully updated." });
});

/**
 * PATCH /account/name
 * @summary Update User Name
 * @description Updates the authenticated user's first name and last name.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateName} request.body.required - Name information containing firstName and lastName
 * @return {object} 200 - Name successfully updated
 * @return {object} 401 - User is not authenticated
 */
app.patch("/name", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    if (validateSchema(res, updateNameValidation, req.body)) return;

    await updateName(req.user.id, req.body);

    res.json({ message: "Your name has been successfully updated." });
});

/**
 * POST /account/register
 * @summary Register New Account
 * @description Creates a new user account during first-time setup or by administrators. Used for initial user registration.
 * @tags Account
 * @produces application/json
 * @param {Register} request.body.required - User registration information including username, password, and name details
 * @return {object} 200 - Account creation successful or error information
 */
app.post("/register", async (req, res) => {
    if (validateSchema(res, registerValidation, req.body)) return;

    const account = await createAccount(req.body);
    if (account) return res.json(account);

    res.json({ message: "Your account has been successfully created." });
});

/**
 * GET /account/totp/secret
 * @summary Get TOTP Secret
 * @description Retrieves the TOTP secret and QR code URL for setting up two-factor authentication. Used for configuring authenticator apps.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - TOTP secret and setup URL
 */
app.get("/totp/secret", authenticate, async (req, res) => {
    res.json({
        secret: req.user?.totpSecret,
        url: `otpauth://totp/Nexterm%20%28${req.user?.username}%29?secret=${req.user?.totpSecret}`,
    });
});

/**
 * POST /account/totp/enable
 * @summary Enable TOTP
 * @description Enables two-factor authentication for the user account by verifying a TOTP code from their authenticator app.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @param {TotpSetup} request.body.required - TOTP verification code
 * @return {object} 200 - TOTP successfully enabled
 * @return {object} 400 - Invalid or expired TOTP code
 */
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

/**
 * POST /account/totp/disable
 * @summary Disable TOTP
 * @description Disables two-factor authentication for the user account. Removes the requirement for TOTP codes during login.
 * @tags Account
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - TOTP successfully disabled
 */
app.post("/totp/disable", authenticate, async (req, res) => {
    const enabledError = await updateTOTP(req.user.id, false);
    if (enabledError) return res.json(enabledError);

    res.json({ message: "TOTP has been successfully disabled on your account." });
});

module.exports = app;