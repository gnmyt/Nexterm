const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { registerValidation, totpSetup, ownPasswordChangeValidation, updateNameValidation, updateSessionSyncValidation } = require("../validations/account");
const { preferencesValidation } = require("../validations/preferences");
const { createAccount, selfRegister, getFTSStatus, updateTOTP, changeOwnPassword, updateName, updateSessionSync, updatePreferences, searchUsers, updateAvatar, removeAvatar } = require("../controllers/account");
const { startTotpSetup, verifyTotpCode } = require("../utils/totp");
const express = require("express");
const stateBroadcaster = require("../lib/StateBroadcaster");
const { authenticate, authenticateQuery } = require("../middlewares/auth");
const { getAvatarPath, avatarExists, MAX_AVATAR_UPLOAD_SIZE, AVATAR_CONTENT_TYPE } = require("../utils/avatarService");
const { sendError } = require("../utils/error");
const { getSystemPermissions } = require("../permissions/engine");

const app = Router();

app.get("/search", authenticate, route({
    summary: "Search users",
    description: "Search for users by username, first name, or last name. Returns limited user info for autocomplete purposes. Requires at least 3 characters.",
    query: Joi.object({
        search: Joi.string().allow("").description("Search term (min 3 characters)"),
    }),
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const { search } = req.query;
    res.json(await searchUsers(search));
});

app.get("/me", authenticate, route({
    summary: "Get current user information",
    description: "Retrieves the authenticated user's profile information including username, TOTP status, name, and role.",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const { isAdmin, permissions } = await getSystemPermissions(req.user.id);

    res.json({
        id: req.user.id, username: req.user.username, totpEnabled: req.user.totpEnabled,
        firstName: req.user.firstName, lastName: req.user.lastName,
        isAdmin, permissions,
        sessionSync: req.user.sessionSync, preferences: req.user.preferences || {},
        activeThemeId: req.user.activeThemeId || null,
        avatarHash: req.user.avatarHash || null,
        demoExpiresAt: req.user.demoExpiresAt || null,
        externalSignIn: Boolean(req.user.externalProvider),
    });
});

const avatarBody = express.raw({ type: "*/*", limit: MAX_AVATAR_UPLOAD_SIZE });

const readAvatarBody = (req, res, next) => avatarBody(req, res, (err) => {
    if (err?.type === "entity.too.large")
        return sendError(res, 413, 109, "The provided image is too large.");
    next(err);
});

app.post("/me/avatar", authenticate, readAvatarBody, route({
    summary: "Upload profile picture",
    description: "Uploads a profile picture for the authenticated user. The body must be the raw image bytes in the WebP format, cropped and resized by the client.",
    consumes: "image/webp",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        return sendError(res, 400, 107, "You need to provide the image data in the request body.");

    const result = await updateAvatar(req.user.id, req.body);
    if (result?.code) return res.json(result);

    res.json({ message: "Your profile picture has been successfully updated.", avatarHash: result.avatarHash });
});

app.delete("/me/avatar", authenticate, route({
    summary: "Remove profile picture",
    description: "Removes the authenticated user's profile picture, falling back to the generated letter avatar.",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const error = await removeAvatar(req.user.id);
    if (error) return res.json(error);

    res.json({ message: "Your profile picture has been successfully removed." });
});

app.get("/:accountId/avatar", authenticateQuery, route({
    summary: "Get profile picture",
    description: "Returns the profile picture of the requested account as a WebP image. Authenticated through a session token in the query string so the URL can be used directly as an image source.",
    query: Joi.object({
        token: Joi.string().required().description("Session token"),
    }),
    produces: "image/webp",
}), async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!Number.isInteger(accountId) || !avatarExists(accountId))
        return sendError(res, 404, 102, "The requested profile picture does not exist.");

    res.setHeader("Content-Type", AVATAR_CONTENT_TYPE);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.sendFile(getAvatarPath(accountId));
});

app.patch("/password", authenticate, route({
    summary: "Update password",
    description: "Updates the authenticated user's password. Requires the current password and signs out all other sessions of the account.",
    body: ownPasswordChangeValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");
    if (!req.session) return sendError(res, 403, 207, "Your password can only be changed from a signed-in session.");

    const result = await changeOwnPassword(req.user, req.session.id, req.body.currentPassword, req.body.password);
    if (result?.code) return sendError(res, result.code, result.code, result.message);

    res.json({ message: "Your password has been successfully updated." });
});

app.patch("/name", authenticate, route({
    summary: "Update user name",
    description: "Updates the authenticated user's first name and last name.",
    body: updateNameValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    await updateName(req.user.id, req.body);

    res.json({ message: "Your name has been successfully updated." });
});

app.post("/register", route({
    summary: "Register new account",
    description: "Creates a new user account. During first-time setup the first admin account is created. Afterwards, registration is only permitted when an administrator has enabled self-registration for the internal authentication provider.",
    body: registerValidation,
}), async (req, res) => {
    const account = await getFTSStatus() ? await createAccount(req.body) : await selfRegister(req.body);
    if (account) return res.json(account);

    res.json({ message: "Your account has been successfully created." });
});

app.get("/totp/secret", authenticate, route({
    summary: "Get TOTP secret",
    description: "Generates a new TOTP secret and QR code URL for setting up two-factor authentication. Only available while two-factor authentication is off.",
}), async (req, res) => {
    if (req.user.totpEnabled) return sendError(res, 409, 208, "Two-factor authentication is already enabled. Disable it to set it up again.");

    const secret = await startTotpSetup(req.user);
    res.json({
        secret,
        url: `otpauth://totp/Nexterm%20%28${encodeURIComponent(req.user.username)}%29?secret=${secret}`,
    });
});

app.post("/totp/enable", authenticate, route({
    summary: "Enable TOTP",
    description: "Enables two-factor authentication for the user account by verifying a TOTP code from their authenticator app.",
    body: totpSetup,
}), async (req, res) => {
    if (!verifyTotpCode(req.user, req.body.code))
        return sendError(res, 400, 203, "Your provided code is invalid or has expired.", {
            serverTime: new Date().toISOString()
        });

    const enabledError = await updateTOTP(req.user?.id, true);
    if (enabledError) return res.json(enabledError);

    res.json({ message: "TOTP has been successfully enabled on your account." });
});

app.post("/totp/disable", authenticate, route({
    summary: "Disable TOTP",
    description: "Disables two-factor authentication for the user account. Removes the requirement for TOTP codes during login.",
}), async (req, res) => {
    const enabledError = await updateTOTP(req.user.id, false);
    if (enabledError) return res.json(enabledError);

    res.json({ message: "TOTP has been successfully disabled on your account." });
});

app.patch("/session-sync", authenticate, route({
    summary: "Update session synchronization",
    description: "Updates the session synchronization mode for the user account.",
    body: updateSessionSyncValidation,
}), async (req, res) => {
    const error = await updateSessionSync(req.user.id, req.body.sessionSync);
    if (error) return res.json(error);

    res.json({ message: "Session synchronization mode has been successfully updated." });
});

app.patch("/me/preferences", authenticate, route({
    summary: "Update user preferences",
    description: "Updates the user's preferences (terminal settings, theme, file settings). Performs a deep merge with existing preferences.",
    body: preferencesValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const result = await updatePreferences(req.user.id, req.body);
    if (result?.code) return res.json(result);

    if (req.body.sessions) stateBroadcaster.broadcast("CONNECTIONS", { accountId: req.user.id });

    res.json({ message: "Preferences successfully updated.", preferences: result });
});

module.exports = app;