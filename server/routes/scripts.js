const { Router } = require("express");
const {
    getScripts,
    getScript,
    searchScripts,
    createCustomScript,
    updateCustomScript,
    deleteCustomScript,
    refreshScripts,
} = require("../controllers/script");
const { validateSchema } = require("../utils/schema");
const { scriptValidation } = require("../validations/script");

const app = Router();

/**
 * POST /scripts/refresh
 * @summary Refresh Scripts
 * @description Refreshes the scripts catalog by reloading all available scripts from configured sources and updating the user's script library.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Scripts successfully refreshed
 */
app.post("/refresh", async (req, res) => {
    try {
        refreshScripts(req.user.id);
        res.json({ message: "Scripts got successfully refreshed" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * GET /scripts
 * @summary Get Scripts
 * @description Retrieves available scripts for the authenticated user. Supports searching by name or description when search parameter is provided.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @param {string} search.query - Search term to filter scripts by name or description
 * @return {array} 200 - List of scripts available to the user
 */
app.get("/", async (req, res) => {
    try {
        if (req.query.search) {
            res.json(searchScripts(req.query.search, req.user.id));
        } else {
            res.json(getScripts(req.user.id));
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * GET /scripts/{scriptId}
 * @summary Get Script Details
 * @description Retrieves detailed information about a specific script including its content, parameters, and metadata.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @param {string} scriptId.path.required - The unique identifier of the script (URL encoded)
 * @return {object} 200 - Script details
 * @return {object} 404 - Script not found
 */
app.get("/:scriptId", async (req, res) => {
    try {
        const decodedScriptId = decodeURIComponent(req.params.scriptId);
        const script = getScript(decodedScriptId, req.user.id);
        if (!script) {
            return res.status(404).json({ code: 404, message: "Script not found" });
        }
        res.json(script);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /scripts
 * @summary Create Custom Script
 * @description Creates a new custom script that can be executed on servers. Users can define their own automation scripts with custom parameters.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @param {Script} request.body.required - Script configuration including name, content, description, and parameters
 * @return {object} 201 - Script successfully created
 * @return {object} 409 - Script with this name already exists
 */
app.post("/", async (req, res) => {
    if (validateSchema(res, scriptValidation, req.body)) return;

    try {
        const script = createCustomScript(req.user.id, req.body);
        res.status(201).json(script);
    } catch (error) {
        if (error.message === "A script with this name already exists") {
            return res.status(409).json({ code: 409, message: error.message });
        }
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * PUT /scripts/{scriptId}
 * @summary Update Custom Script
 * @description Updates an existing custom script's content, parameters, or other properties. Only the script creator can modify custom scripts.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @param {string} scriptId.path.required - The unique identifier of the script to update (URL encoded)
 * @param {Script} request.body.required - Updated script configuration
 * @return {object} 200 - Script successfully updated
 * @return {object} 404 - Script not found or unauthorized
 */
app.put("/:scriptId", async (req, res) => {
    if (validateSchema(res, scriptValidation, req.body)) return;

    try {
        const decodedScriptId = decodeURIComponent(req.params.scriptId);
        const script = updateCustomScript(req.user.id, decodedScriptId, req.body);
        res.json(script);
    } catch (error) {
        if (error.message === "Unauthorized to edit this script" || error.message === "Script not found") {
            return res.status(404).json({ code: 404, message: error.message });
        }
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * DELETE /scripts/{scriptId}
 * @summary Delete Custom Script
 * @description Permanently removes a custom script from the user's library. Only the script creator can delete custom scripts.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @param {string} scriptId.path.required - The unique identifier of the script to delete (URL encoded)
 * @return {object} 200 - Script successfully deleted
 * @return {object} 404 - Script not found or unauthorized
 */
app.delete("/:scriptId", async (req, res) => {
    try {
        const decodedScriptId = decodeURIComponent(req.params.scriptId);
        deleteCustomScript(req.user.id, decodedScriptId);
        res.json({ message: "Script deleted successfully" });
    } catch (error) {
        if (error.message === "Unauthorized to delete this script" || error.message === "Script not found") {
            return res.status(404).json({ code: 404, message: error.message });
        }
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
