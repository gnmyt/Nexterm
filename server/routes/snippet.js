const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { createSnippet, deleteSnippet, editSnippet, getSnippet, listAllAccessibleSnippets, listAllSourceSnippets, repositionSnippet } = require("../controllers/snippet");
const { snippetCreationValidation, snippetEditValidation, snippetRepositionValidation } = require("../validations/snippet");
const OrganizationMember = require("../models/OrganizationMember");
const { hasOrganizationAccess } = require("../utils/permission");

const app = Router();


app.get("/all", route({
    summary: "List all accessible snippets",
    description: "Retrieves all snippets accessible to the user (personal + organization snippets)",
    returns: objectList,
}), async (req, res) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId: req.user.id } });
    const organizationIds = memberships.map(m => m.organizationId);
    
    res.json(await listAllAccessibleSnippets(req.user.id, organizationIds));
});

app.get("/sources", route({
    summary: "List all source snippets",
    description: "Retrieves all snippets from external sources",
    returns: objectList,
}), async (req, res) => {
    res.json(await listAllSourceSnippets());
});

app.get("/:snippetId", route({
    summary: "Get snippet details",
    description: "Retrieves detailed information about a specific snippet including its content and metadata.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if accessing organization snippet"),
    }),
}), async (req, res) => {
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }
    
    const snippet = await getSnippet(req.user.id, req.params.snippetId, organizationId);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json(snippet);
});

app.put("/", route({
    summary: "Create new snippet",
    description: "Creates a new code snippet that can be reused across different sessions and servers.",
    body: snippetCreationValidation,
}), async (req, res) => {
    if (req.body.organizationId && !(await hasOrganizationAccess(req.user.id, req.body.organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const snippet = await createSnippet(req.user.id, req.body);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json({ message: "Snippet created successfully", id: snippet.id });
});

app.patch("/:snippetId", route({
    summary: "Update snippet",
    description: "Updates an existing snippet's content, name, or other properties.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if updating organization snippet"),
    }),
    body: snippetEditValidation,
}), async (req, res) => {
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const snippet = await editSnippet(req.user.id, req.params.snippetId, req.body, organizationId);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json({ message: "Snippet updated successfully" });
});

app.delete("/:snippetId", route({
    summary: "Delete snippet",
    description: "Permanently removes a snippet from the user's account. This action cannot be undone.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if deleting organization snippet"),
    }),
}), async (req, res) => {
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const snippet = await deleteSnippet(req.user.id, req.params.snippetId, organizationId);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json({ message: "Snippet deleted successfully" });
});

app.patch("/:snippetId/reposition", route({
    summary: "Reposition snippet",
    description: "Moves a snippet to a new position relative to another snippet.",
    query: Joi.object({
        organizationId: Joi.string().allow("").description("Optional: Organization ID if repositioning organization snippet"),
    }),
    body: snippetRepositionValidation,
}), async (req, res) => {
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const result = await repositionSnippet(req.user.id, req.params.snippetId, req.body, organizationId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Snippet repositioned successfully" });
});

module.exports = app;