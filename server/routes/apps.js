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

app.post("/refresh", async (req, res) => {
    await refreshAppSources();
    res.json({ message: "Apps got successfully refreshed" });
});

app.get("/", async (req, res) => {
    if (req.query.category) {
        res.json(await getAppsByCategory(req.query.category));
    } else if (req.query.search) {
        res.json(await searchApp(req.query.search));
    } else {
        res.json(await getApps());
    }
});

app.get("/sources", isAdmin, async (req, res) => {
    res.json(await getAppSources());
});

app.put("/sources", isAdmin, async (req, res) => {
    if (validateSchema(res, createAppSourceValidation, req.body)) return;

    const appSource = await createAppSource(req.body);
    if (appSource?.code) return res.json(appSource);

    res.json({ message: "App source got successfully created" });
});

app.delete("/sources/:appSource", isAdmin, async (req, res) => {
    if (req.params.appSource === "official")
        return res.json({ code: 103, message: "You can't delete the default app source" });

    const appSource = await deleteAppSource(req.params.appSource);
    if (appSource?.code) return res.json(appSource);

    res.json({ message: "App source got successfully deleted" });
});

app.patch("/sources/:appSource", isAdmin, async (req, res) => {
    if (req.params.appSource === "official")
        return res.json({ code: 103, message: "You can't edit the default app source" });

    if (validateSchema(res, updateAppUrlValidation, req.body)) return;

    const appSource = await updateAppUrl(req.params.appSource, req.body.url);
    if (appSource?.code) return res.json(appSource);

    res.json({ message: "App source got successfully edited" });
});

module.exports = app;
