const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const {
    createSource,
    listSources,
    getSource,
    updateSource,
    deleteSource,
    syncSource,
    syncAllSources,
    validateSourceUrl,
} = require("../controllers/source");
const {
    sourceCreationValidation,
    sourceUpdateValidation,
    validateUrlValidation,
} = require("../validations/source");

const app = Router();

app.get("/", route({
    summary: "List all sources",
    description: "Retrieves all configured snippet/script sources",
    returns: objectList,
}), async (req, res) => {
    try {
        const sources = await listSources();
        res.json(sources);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/:sourceId", route({
    summary: "Get source details",
    description: "Retrieves detailed information about a specific source",
}), async (req, res) => {
    try {
        const source = await getSource(parseInt(req.params.sourceId));
        if (source?.code) return res.status(source.code).json(source);
        res.json(source);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/validate", route({
    summary: "Validate source URL",
    description: "Validates a source URL by checking if NTINDEX is accessible and valid",
    body: validateUrlValidation,
}), async (req, res) => {
    try {
        const result = await validateSourceUrl(req.body.url);
        if (result.valid) {
            res.json({ 
                valid: true, 
                snippetCount: result.index.snippets.length,
                scriptCount: result.index.scripts.length,
                themeCount: result.index.themes.length,
            });
        } else {
            res.json({ valid: false, error: result.error });
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/", route({
    summary: "Create new source",
    status: 201,
    description: "Creates a new snippet/script source and performs initial sync",
    body: sourceCreationValidation,
}), async (req, res) => {
    try {
        const source = await createSource(req.body);
        if (source?.code) return res.status(source.code).json(source);
        res.status(201).json({ message: "Source created successfully", id: source.id });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.patch("/:sourceId", route({
    summary: "Update source",
    description: "Updates an existing source's name, URL, or enabled status",
    body: sourceUpdateValidation,
}), async (req, res) => {
    try {
        const source = await updateSource(parseInt(req.params.sourceId), req.body);
        if (source?.code) return res.status(source.code).json(source);
        res.json({ message: "Source updated successfully", source });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.delete("/:sourceId", route({
    summary: "Delete source",
    description: "Deletes a source and all its synced snippets/scripts",
}), async (req, res) => {
    try {
        const result = await deleteSource(parseInt(req.params.sourceId));
        if (result?.code) return res.status(result.code).json(result);
        res.json({ message: "Source deleted successfully" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/:sourceId/sync", route({
    summary: "Sync source",
    description: "Manually triggers a sync for a specific source",
}), async (req, res) => {
    try {
        const result = await syncSource(parseInt(req.params.sourceId));
        if (result.success) {
            res.json({ message: "Source synced successfully" });
        } else {
            res.status(400).json({ code: 400, message: result.error });
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/sync-all", route({
    summary: "Sync all sources",
    description: "Manually triggers a sync for all enabled sources",
}), async (req, res) => {
    try {
        syncAllSources().catch(err => {
            console.error("Background sync failed:", err);
        });
        res.json({ message: "Sync initiated for all sources" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
