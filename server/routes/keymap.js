const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const { getKeymaps, updateKeymap, resetKeymaps, resetKeymap } = require("../controllers/keymap");
const { updateKeymapValidation } = require("../validations/keymap");
const { validateSchema } = require("../utils/schema");
const { sendError } = require("../utils/error");

const app = Router();

/**
 * GET /keymaps
 * @summary Get User Keymaps
 * @description Retrieves all keyboard shortcuts/keybinds for the authenticated user. If none exist, creates default keymaps.
 * @tags Keymaps
 * @produces application/json
 * @security BearerAuth
 * @return {array<object>} 200 - Array of keymap objects with action, key, and enabled status
 * @return {object} 401 - User is not authenticated
 */
app.get("/", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const keymaps = await getKeymaps(req.user.id);
    res.json(keymaps);
});

/**
 * PATCH /keymaps/:action
 * @summary Update Keymap
 * @description Updates a specific keyboard shortcut for the authenticated user. Can modify the key combination or enable/disable the shortcut.
 * @tags Keymaps
 * @produces application/json
 * @security BearerAuth
 * @param {string} action.path.required - The action identifier (e.g., 'search', 'ai-menu', 'snippets', 'keyboard-shortcuts')
 * @param {object} request.body.required - Updates to apply (key and/or enabled)
 * @return {object} 200 - Keymap successfully updated
 * @return {object} 400 - Key combination already in use or invalid request
 * @return {object} 401 - User is not authenticated
 * @return {object} 404 - Keymap not found
 */
app.patch("/:action", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    if (validateSchema(res, updateKeymapValidation, req.body)) return;

    const { action } = req.params;
    const updates = {};

    if (req.body.key !== undefined) updates.key = req.body.key;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;

    if (Object.keys(updates).length === 0) {
        return sendError(res, 400, 404, "No updates provided");
    }

    const error = await updateKeymap(req.user.id, action, updates);
    if (error) return sendError(res, 400, error.code, error.message);

    res.json({ message: "Keymap successfully updated" });
});

/**
 * POST /keymaps/reset
 * @summary Reset All Keymaps
 * @description Resets all keyboard shortcuts to their default values for the authenticated user.
 * @tags Keymaps
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - All keymaps successfully reset to defaults
 * @return {object} 401 - User is not authenticated
 */
app.post("/reset", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    await resetKeymaps(req.user.id);
    res.json({ message: "All keymaps have been reset to defaults" });
});

/**
 * POST /keymaps/:action/reset
 * @summary Reset Single Keymap
 * @description Resets a specific keyboard shortcut to its default value for the authenticated user.
 * @tags Keymaps
 * @produces application/json
 * @security BearerAuth
 * @param {string} action.path.required - The action identifier to reset
 * @return {object} 200 - Keymap successfully reset to default
 * @return {object} 400 - Invalid action
 * @return {object} 401 - User is not authenticated
 * @return {object} 404 - Keymap not found
 */
app.post("/:action/reset", authenticate, async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const { action } = req.params;
    const error = await resetKeymap(req.user.id, action);
    if (error) return sendError(res, 400, error.code, error.message);

    res.json({ message: "Keymap has been reset to default" });
});

module.exports = app;
