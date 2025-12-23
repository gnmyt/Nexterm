const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
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

/**
 * GET /sources
 * @summary List All Sources
 * @description Retrieves all configured snippet/script sources
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of all sources
 */
app.get("/", async (req, res) => {
    try {
        const sources = await listSources();
        res.json(sources);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * GET /sources/:sourceId
 * @summary Get Source Details
 * @description Retrieves detailed information about a specific source
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @param {number} sourceId.path.required - The source ID
 * @return {object} 200 - Source details
 * @return {object} 404 - Source not found
 */
app.get("/:sourceId", async (req, res) => {
    try {
        const source = await getSource(parseInt(req.params.sourceId));
        if (source?.code) return res.status(source.code).json(source);
        res.json(source);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /sources/validate
 * @summary Validate Source URL
 * @description Validates a source URL by checking if NTINDEX is accessible and valid
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - URL to validate
 * @return {object} 200 - Validation result
 */
app.post("/validate", async (req, res) => {
    if (validateSchema(res, validateUrlValidation, req.body)) return;

    try {
        const result = await validateSourceUrl(req.body.url);
        if (result.valid) {
            res.json({ 
                valid: true, 
                snippetCount: result.index.snippets.length,
                scriptCount: result.index.scripts.length,
            });
        } else {
            res.json({ valid: false, error: result.error });
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /sources
 * @summary Create New Source
 * @description Creates a new snippet/script source and performs initial sync
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Source configuration
 * @return {object} 201 - Source created successfully
 * @return {object} 400 - Invalid URL
 * @return {object} 409 - Source with URL already exists
 */
app.post("/", async (req, res) => {
    if (validateSchema(res, sourceCreationValidation, req.body)) return;

    try {
        const source = await createSource(req.body);
        if (source?.code) return res.status(source.code).json(source);
        res.status(201).json({ message: "Source created successfully", id: source.id });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * PATCH /sources/:sourceId
 * @summary Update Source
 * @description Updates an existing source's name, URL, or enabled status
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @param {number} sourceId.path.required - The source ID
 * @param {object} request.body.required - Updated source fields
 * @return {object} 200 - Source updated successfully
 * @return {object} 404 - Source not found
 */
app.patch("/:sourceId", async (req, res) => {
    if (validateSchema(res, sourceUpdateValidation, req.body)) return;

    try {
        const source = await updateSource(parseInt(req.params.sourceId), req.body);
        if (source?.code) return res.status(source.code).json(source);
        res.json({ message: "Source updated successfully", source });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * DELETE /sources/:sourceId
 * @summary Delete Source
 * @description Deletes a source and all its synced snippets/scripts
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @param {number} sourceId.path.required - The source ID
 * @return {object} 200 - Source deleted successfully
 * @return {object} 404 - Source not found
 */
app.delete("/:sourceId", async (req, res) => {
    try {
        const result = await deleteSource(parseInt(req.params.sourceId));
        if (result?.code) return res.status(result.code).json(result);
        res.json({ message: "Source deleted successfully" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /sources/:sourceId/sync
 * @summary Sync Source
 * @description Manually triggers a sync for a specific source
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @param {number} sourceId.path.required - The source ID
 * @return {object} 200 - Sync result
 */
app.post("/:sourceId/sync", async (req, res) => {
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

/**
 * POST /sources/sync-all
 * @summary Sync All Sources
 * @description Manually triggers a sync for all enabled sources
 * @tags Sources
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Sync initiated
 */
app.post("/sync-all", async (req, res) => {
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
