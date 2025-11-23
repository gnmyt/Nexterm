const { Router } = require("express");
const {
    listScripts,
    getScript,
    searchScripts,
    createScript,
    editScript,
    deleteScript,
    listAllAccessibleScripts,
} = require("../controllers/script");
const { validateSchema } = require("../utils/schema");
const { scriptCreationValidation, scriptEditValidation } = require("../validations/script");
const OrganizationMember = require("../models/OrganizationMember");

const app = Router();

/**
 * GET /scripts
 * @summary Get Scripts
 * @description Retrieves available scripts for the authenticated user. Supports searching by name or description when search parameter is provided.
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @param {string} search.query - Search term to filter scripts by name or description
 * @param {string} organizationId.query - Optional: Filter scripts by organization ID
 * @return {array} 200 - List of scripts available to the user
 */
app.get("/", async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId) {
            const membership = await OrganizationMember.findOne({ 
                where: { accountId: req.user.id, organizationId } 
            });
            
            if (!membership) {
                return res.status(403).json({ code: 403, message: "Access denied to this organization" });
            }
        }
        
        if (req.query.search) {
            res.json(await searchScripts(req.user.id, req.query.search, organizationId));
        } else {
            res.json(await listScripts(req.user.id, organizationId));
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * GET /scripts/all
 * @summary List All Accessible Scripts
 * @description Retrieves all scripts accessible to the user (personal + organization scripts)
 * @tags Scripts
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of all accessible scripts
 */
app.get("/all", async (req, res) => {
    try {
        const memberships = await OrganizationMember.findAll({ where: { accountId: req.user.id } });
        const organizationIds = memberships.map(m => m.organizationId);
        
        res.json(await listAllAccessibleScripts(req.user.id, organizationIds));
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
 * @param {string} scriptId.path.required - The unique identifier of the script
 * @param {string} organizationId.query - Optional: Organization ID if accessing organization script
 * @return {object} 200 - Script details
 * @return {object} 404 - Script not found
 */
app.get("/:scriptId", async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId) {
            const membership = await OrganizationMember.findOne({ 
                where: { accountId: req.user.id, organizationId } 
            });
            
            if (!membership) {
                return res.status(403).json({ code: 403, message: "Access denied to this organization" });
            }
        }
        
        const script = await getScript(req.user.id, req.params.scriptId, organizationId);
        if (!script) {
            return res.status(404).json({ code: 404, message: "Script not found" });
        }
        if (script.code) {
            return res.status(script.code).json(script);
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
    if (validateSchema(res, scriptCreationValidation, req.body)) return;

    try {
        if (req.body.organizationId) {
            const membership = await OrganizationMember.findOne({ 
                where: { accountId: req.user.id, organizationId: req.body.organizationId } 
            });
            
            if (!membership) {
                return res.status(403).json({ code: 403, message: "Access denied to this organization" });
            }
        }

        const script = await createScript(req.user.id, req.body);
        res.status(201).json({ message: "Script created successfully", id: script.id });
    } catch (error) {
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
 * @param {string} scriptId.path.required - The unique identifier of the script to update
 * @param {string} organizationId.query - Optional: Organization ID if updating organization script
 * @param {Script} request.body.required - Updated script configuration
 * @return {object} 200 - Script successfully updated
 * @return {object} 404 - Script not found or unauthorized
 */
app.put("/:scriptId", async (req, res) => {
    if (validateSchema(res, scriptEditValidation, req.body)) return;

    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId) {
            const membership = await OrganizationMember.findOne({ 
                where: { accountId: req.user.id, organizationId } 
            });
            
            if (!membership) {
                return res.status(403).json({ code: 403, message: "Access denied to this organization" });
            }
        }

        const result = await editScript(req.user.id, req.params.scriptId, req.body, organizationId);
        if (result?.code) {
            return res.status(result.code).json(result);
        }
        res.json({ message: "Script updated successfully" });
    } catch (error) {
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
 * @param {string} scriptId.path.required - The unique identifier of the script to delete
 * @param {string} organizationId.query - Optional: Organization ID if deleting organization script
 * @return {object} 200 - Script successfully deleted
 * @return {object} 404 - Script not found or unauthorized
 */
app.delete("/:scriptId", async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId) {
            const membership = await OrganizationMember.findOne({ 
                where: { accountId: req.user.id, organizationId } 
            });
            
            if (!membership) {
                return res.status(403).json({ code: 403, message: "Access denied to this organization" });
            }
        }

        const result = await deleteScript(req.user.id, req.params.scriptId, organizationId);
        if (result?.code) {
            return res.status(result.code).json(result);
        }
        res.json({ message: "Script deleted successfully" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
