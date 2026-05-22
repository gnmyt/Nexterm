const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
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

/**
 * GET /themes
 * @summary List All Themes
 * @description Retrieves all available themes including custom and source-synced themes
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of themes
 */
app.get("/", async (req, res) => {
    res.json(await listThemes(req.user.id));
});

/**
 * GET /themes/active/css
 * @summary Get Active Theme CSS
 * @description Returns the CSS content of the currently active theme for the authenticated user
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - CSS content of the active theme
 */
app.get("/active/css", async (req, res) => {
    const css = await getActiveThemeCSS(req.user.id);
    res.json({ css });
});

/**
 * GET /themes/{themeId}
 * @summary Get Theme Details
 * @description Retrieves detailed information about a specific theme
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @param {string} themeId.path.required - The unique identifier of the theme
 * @return {object} 200 - Theme details
 * @return {object} 404 - Theme not found
 */
app.get("/:themeId", async (req, res) => {
    const theme = await getTheme(parseInt(req.params.themeId));
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json(theme);
});

/**
 * GET /themes/{themeId}/css
 * @summary Get Theme CSS
 * @description Retrieves the raw CSS content of a specific theme
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @param {string} themeId.path.required - The unique identifier of the theme
 * @return {object} 200 - CSS content of the theme
 * @return {object} 404 - Theme not found
 */
app.get("/:themeId/css", async (req, res) => {
    const theme = await getThemeCSS(parseInt(req.params.themeId));
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json({ css: theme.css });
});

/**
 * PUT /themes
 * @summary Create Custom Theme
 * @description Creates a new custom CSS theme for the authenticated user
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @param {ThemeCreation} request.body.required - Theme configuration including name, CSS content, and optional description
 * @return {object} 201 - Theme successfully created
 * @return {object} 400 - Invalid theme configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, themeCreationValidation, req.body)) return;

    const theme = await createTheme(req.body, req.user.id);
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json({ message: "Theme created successfully", id: theme.id });
});

/**
 * PATCH /themes/{themeId}
 * @summary Update Theme
 * @description Updates an existing custom theme's name, CSS content, or description
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @param {string} themeId.path.required - The unique identifier of the theme to update
 * @param {ThemeUpdate} request.body.required - Updated theme configuration fields
 * @return {object} 200 - Theme successfully updated
 * @return {object} 403 - Cannot edit source-synced themes
 * @return {object} 404 - Theme not found
 */
app.patch("/:themeId", async (req, res) => {
    if (validateSchema(res, themeUpdateValidation, req.body)) return;

    const theme = await updateTheme(parseInt(req.params.themeId), req.user.id, req.body);
    if (theme?.code) return res.status(theme.code).json(theme);
    res.json(theme);
});

/**
 * DELETE /themes/{themeId}
 * @summary Delete Theme
 * @description Permanently removes a custom theme. Source-synced themes cannot be deleted.
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @param {string} themeId.path.required - The unique identifier of the theme to delete
 * @return {object} 200 - Theme successfully deleted
 * @return {object} 403 - Cannot delete source-synced themes
 * @return {object} 404 - Theme not found
 */
app.delete("/:themeId", async (req, res) => {
    const result = await deleteTheme(parseInt(req.params.themeId), req.user.id);
    if (result?.code) return res.status(result.code).json(result);
    res.json({ message: "Theme deleted successfully" });
});

/**
 * PUT /themes/active
 * @summary Set Active Theme
 * @description Sets or clears the active theme for the authenticated user. Pass null as themeId to deactivate.
 * @tags Theme
 * @produces application/json
 * @security BearerAuth
 * @param {ActiveTheme} request.body.required - Theme ID to activate, or null to deactivate
 * @return {object} 200 - Active theme updated
 * @return {object} 404 - Theme not found
 */
app.put("/active", async (req, res) => {
    if (validateSchema(res, activeThemeValidation, req.body)) return;

    const result = await setActiveTheme(req.user.id, req.body.themeId);
    if (result?.code) return res.status(result.code).json(result);
    res.json(result);
});

module.exports = app;
