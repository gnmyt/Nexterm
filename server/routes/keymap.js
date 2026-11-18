const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { authenticate } = require("../middlewares/auth");
const { getKeymaps, updateKeymap, resetKeymaps, resetKeymap } = require("../controllers/keymap");
const { updateKeymapValidation } = require("../validations/keymap");
const { sendError } = require("../utils/error");

const app = Router();

app.get("/", authenticate, route({
    summary: "Get user keymaps",
    description: "Retrieves all keyboard shortcuts/keybinds for the authenticated user. If none exist, creates default keymaps.",
    returns: objectList,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const keymaps = await getKeymaps(req.user.id);
    res.json(keymaps);
});

app.patch("/:action", authenticate, route({
    summary: "Update keymap",
    description: "Updates a specific keyboard shortcut for the authenticated user. Can modify the key combination or enable/disable the shortcut.",
    body: updateKeymapValidation,
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

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

app.post("/reset", authenticate, route({
    summary: "Reset all keymaps",
    description: "Resets all keyboard shortcuts to their default values for the authenticated user.",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    await resetKeymaps(req.user.id);
    res.json({ message: "All keymaps have been reset to defaults" });
});

app.post("/:action/reset", authenticate, route({
    summary: "Reset single keymap",
    description: "Resets a specific keyboard shortcut to its default value for the authenticated user.",
}), async (req, res) => {
    if (!req.user) return sendError(res, 401, 205, "You are not authenticated.");

    const { action } = req.params;
    const error = await resetKeymap(req.user.id, action);
    if (error) return sendError(res, 400, error.code, error.message);

    res.json({ message: "Keymap has been reset to default" });
});

module.exports = app;
