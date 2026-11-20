const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const {
    listThemes,
    getTheme,
    getThemeCSS,
    createTheme,
    updateTheme,
    deleteTheme,
    setActiveTheme,
    getActiveThemeCSS,
} = require("../controllers/theme");
const { themeCreationValidation, themeUpdateValidation, activeThemeValidation } = require("../validations/theme");

const app = Router();

app.get("/", route({
    summary: "List all themes",
    description: "Retrieves all available themes including custom and source-synced themes",
    returns: objectList,
}), async (req, res) => {
    res.json(await listThemes(req.user.id));
});

app.get("/active/css", route({
    summary: "Get active theme CSS",
    description: "Returns the CSS content of the currently active theme for the authenticated user",
}), async (req, res) => {
    const css = await getActiveThemeCSS(req.user.id);
    res.json({ css });
});

app.get("/:themeId", route({
    summary: "Get theme details",
    description: "Retrieves detailed information about a specific theme",
}), async (req, res) => {
    const theme = await getTheme(parseInt(req.params.themeId));
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json(theme);
});

app.get("/:themeId/css", route({
    summary: "Get theme CSS",
    description: "Retrieves the raw CSS content of a specific theme",
}), async (req, res) => {
    const theme = await getThemeCSS(parseInt(req.params.themeId));
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json({ css: theme.css });
});

app.put("/", route({
    summary: "Create custom theme",
    description: "Creates a new custom CSS theme for the authenticated user",
    body: themeCreationValidation,
}), async (req, res) => {
    const theme = await createTheme(req.body, req.user.id);
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json({ message: "Theme created successfully", id: theme.id });
});

app.patch("/:themeId", route({
    summary: "Update theme",
    description: "Updates an existing custom theme's name, CSS content, or description",
    body: themeUpdateValidation,
}), async (req, res) => {
    const theme = await updateTheme(parseInt(req.params.themeId), req.user.id, req.body);
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json(theme);
});

app.delete("/:themeId", route({
    summary: "Delete theme",
    description: "Permanently removes a custom theme. Source-synced themes cannot be deleted.",
}), async (req, res) => {
    const result = await deleteTheme(parseInt(req.params.themeId), req.user.id);
    if (result?.code) return res.status(result.code).json(result);
    res.json({ message: "Theme deleted successfully" });
});

app.put("/active", route({
    summary: "Set active theme",
    description: "Sets or clears the active theme for the authenticated user. Pass null as themeId to deactivate.",
    body: activeThemeValidation,
}), async (req, res) => {
    const result = await setActiveTheme(req.user.id, req.body.themeId);
    if (result?.code) return res.status(result.code).json(result);
    res.json(result);
});

module.exports = app;
