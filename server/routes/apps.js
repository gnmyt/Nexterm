const { Router } = require("express");
const {
    getAppsByCategory,
    getApps,
    searchApp,
    getAppSources,
    createAppSource,
    deleteAppSource,
    updateAppUrl,
    refreshAppSources,
} = require("../controllers/appSource");
const { validateSchema } = require("../utils/schema");
const { createAppSourceValidation, updateAppUrlValidation } = require("../validations/appSource");
const { isAdmin } = require("../middlewares/permission");

const app = Router();

/**
 * POST /apps/refresh
 * @summary Refresh App Sources
 * @description Refreshes all configured app sources to update the available applications catalog with the latest packages and versions.
 * @tags Apps
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - App sources successfully refreshed
 */
app.post("/refresh", async (req, res) => {
    await refreshAppSources();
    res.json({ message: "Apps got successfully refreshed" });
});

/**
 * GET /apps
 * @summary Get Applications
 * @description Retrieves applications from the catalog. Supports filtering by category or searching by name. Without parameters, returns all available apps.
 * @tags Apps
 * @produces application/json
 * @security BearerAuth
 * @param {string} category.query - Filter applications by category
 * @param {string} search.query - Search applications by name or description
 * @return {array} 200 - List of applications matching the criteria
 */
app.get("/", async (req, res) => {
    if (req.query.category) {
        res.json(await getAppsByCategory(req.query.category));
    } else if (req.query.search) {
        res.json(await searchApp(req.query.search));
    } else {
        res.json(await getApps());
    }
});

/**
 * GET /apps/sources
 * @summary List App Sources
 * @description Retrieves all configured application sources including official and custom repositories. Admin access required.
 * @tags Apps
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of app sources
 * @return {object} 403 - Admin access required
 */
app.get("/sources", isAdmin, async (req, res) => {
    res.json(await getAppSources());
});

/**
 * PUT /apps/sources
 * @summary Create App Source
 * @description Creates a new application source repository for extending the available apps catalog. Admin access required.
 * @tags Apps
 * @produces application/json
 * @security BearerAuth
 * @param {CreateAppSource} request.body.required - App source configuration including name and URL
 * @return {object} 200 - App source successfully created
 * @return {object} 403 - Admin access required
 */
app.put("/sources", isAdmin, async (req, res) => {
    if (validateSchema(res, createAppSourceValidation, req.body)) return;

    const appSource = await createAppSource(req.body);
    if (appSource?.code) return res.json(appSource);

    res.json({ message: "App source got successfully created" });
});

/**
 * DELETE /apps/sources/{appSource}
 * @summary Delete App Source
 * @description Permanently removes a custom application source. The official source cannot be deleted. Admin access required.
 * @tags Apps
 * @produces application/json
 * @security BearerAuth
 * @param {string} appSource.path.required - The identifier of the app source to delete
 * @return {object} 200 - App source successfully deleted
 * @return {object} 400 - Cannot delete the official app source
 * @return {object} 403 - Admin access required
 */
app.delete("/sources/:appSource", isAdmin, async (req, res) => {
    if (req.params.appSource === "official")
        return res.status(400).json({ code: 103, message: "You can't delete the default app source" });

    const appSource = await deleteAppSource(req.params.appSource);
    if (appSource?.code) return res.json(appSource);

    res.json({ message: "App source got successfully deleted" });
});

/**
 * PATCH /apps/sources/{appSource}
 * @summary Update App Source
 * @description Updates the URL of a custom application source. The official source cannot be modified. Admin access required.
 * @tags Apps
 * @produces application/json
 * @security BearerAuth
 * @param {string} appSource.path.required - The identifier of the app source to update
 * @param {UpdateAppUrl} request.body.required - Updated URL for the app source
 * @return {object} 200 - App source successfully updated
 * @return {object} 400 - Cannot edit the official app source
 * @return {object} 403 - Admin access required
 */
app.patch("/sources/:appSource", isAdmin, async (req, res) => {
    if (req.params.appSource === "official")
        return res.status(400).json({ code: 103, message: "You can't edit the default app source" });

    if (validateSchema(res, updateAppUrlValidation, req.body)) return;

    const appSource = await updateAppUrl(req.params.appSource, req.body.url);
    if (appSource?.code) return res.json(appSource);

    res.json({ message: "App source got successfully edited" });
});

module.exports = app;
