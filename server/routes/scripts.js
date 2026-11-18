const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const {
    listScripts,
    getScript,
    searchScripts,
    createScript,
    editScript,
    deleteScript,
    listAllAccessibleScripts,
    listAllSourceScripts,
    repositionScript,
} = require("../controllers/script");
const { scriptCreationValidation, scriptEditValidation, scriptRepositionValidation } = require("../validations/script");
const OrganizationMember = require("../models/OrganizationMember");
const { hasOrganizationAccess } = require("../utils/permission");

const app = Router();

app.get("/", route({
    summary: "Get scripts",
    description: "Retrieves available scripts for the authenticated user. Supports searching by name or description when search parameter is provided.",
    query: Joi.object({
        search: Joi.string().allow("").description("Search term to filter scripts by name or description"),
        organizationId: Joi.string().allow("").description("Optional: Filter scripts by organization ID"),
    }),
    returns: objectList,
}), async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
            return res.status(403).json({ code: 403, message: "Access denied to this organization" });
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

app.get("/all", route({
    summary: "List all accessible scripts",
    description: "Retrieves all scripts accessible to the user (personal + organization scripts)",
    returns: objectList,
}), async (req, res) => {
    try {
        const memberships = await OrganizationMember.findAll({ where: { accountId: req.user.id } });
        const organizationIds = memberships.map(m => m.organizationId);
        
        res.json(await listAllAccessibleScripts(req.user.id, organizationIds));
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/sources", route({
    summary: "List all source scripts",
    description: "Retrieves all scripts from external sources",
    returns: objectList,
}), async (req, res) => {
    try {
        res.json(await listAllSourceScripts());
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/:scriptId", route({
    summary: "Get script details",
    description: "Retrieves detailed information about a specific script including its content, parameters, and metadata.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if accessing organization script"),
    }),
}), async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
            return res.status(403).json({ code: 403, message: "Access denied to this organization" });
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

app.post("/", route({
    summary: "Create custom script",
    status: 201,
    description: "Creates a new custom script that can be executed on servers. Users can define their own automation scripts with custom parameters.",
    body: scriptCreationValidation,
}), async (req, res) => {
    try {
        if (req.body.organizationId && !(await hasOrganizationAccess(req.user.id, req.body.organizationId))) {
            return res.status(403).json({ code: 403, message: "Access denied to this organization" });
        }

        const script = await createScript(req.user.id, req.body);
        res.status(201).json({ message: "Script created successfully", id: script.id });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.put("/:scriptId", route({
    summary: "Update custom script",
    description: "Updates an existing custom script's content, parameters, or other properties. Only the script creator can modify custom scripts.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if updating organization script"),
    }),
    body: scriptEditValidation,
}), async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
            return res.status(403).json({ code: 403, message: "Access denied to this organization" });
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

app.delete("/:scriptId", route({
    summary: "Delete custom script",
    description: "Permanently removes a custom script from the user's library. Only the script creator can delete custom scripts.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if deleting organization script"),
    }),
}), async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
            return res.status(403).json({ code: 403, message: "Access denied to this organization" });
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

app.patch("/:scriptId/reposition", route({
    summary: "Reposition script",
    description: "Moves a script to a new position relative to another script.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if repositioning organization script"),
    }),
    body: scriptRepositionValidation,
}), async (req, res) => {
    try {
        const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
        
        if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
            return res.status(403).json({ code: 403, message: "Access denied to this organization" });
        }

        const result = await repositionScript(req.user.id, req.params.scriptId, req.body, organizationId);
        if (result?.code) {
            return res.status(result.code).json(result);
        }
        res.json({ message: "Script repositioned successfully" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
