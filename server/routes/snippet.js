const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { createSnippet, deleteSnippet, editSnippet, getSnippet, listAllAccessibleSnippets, listAllSourceSnippets, repositionSnippet } = require("../controllers/snippet");
const { snippetCreationValidation, snippetEditValidation, snippetRepositionValidation } = require("../validations/snippet");
const OrganizationMember = require("../models/OrganizationMember");
const { hasOrganizationAccess } = require("../utils/permission");

const app = Router();


/**
 * GET /snippet/all
 * @summary List All Accessible Snippets
 * @description Retrieves all snippets accessible to the user (personal + organization snippets)
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of all accessible snippets
 */
app.get("/all", async (req, res) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId: req.user.id } });
    const organizationIds = memberships.map(m => m.organizationId);
    
    res.json(await listAllAccessibleSnippets(req.user.id, organizationIds));
});

/**
 * GET /snippet/sources
 * @summary List All Source Snippets
 * @description Retrieves all snippets from external sources
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of all source snippets
 */
app.get("/sources", async (req, res) => {
    res.json(await listAllSourceSnippets());
});

/**
 * GET /snippet/{snippetId}
 * @summary Get Snippet Details
 * @description Retrieves detailed information about a specific snippet including its content and metadata.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {string} snippetId.path.required - The unique identifier of the snippet
 * @param {string} organizationId.query - Optional: Organization ID if accessing organization snippet
 * @return {object} 200 - Snippet details
 * @return {object} 404 - Snippet not found
 */
app.get("/:snippetId", async (req, res) => {
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }
    
    const snippet = await getSnippet(req.user.id, req.params.snippetId, organizationId);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json(snippet);
});

/**
 * PUT /snippet
 * @summary Create New Snippet
 * @description Creates a new code snippet that can be reused across different sessions and servers.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {SnippetCreation} request.body.required - Snippet configuration including name, content, and optional description
 * @return {object} 200 - Snippet successfully created with new snippet ID
 * @return {object} 400 - Invalid snippet configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, snippetCreationValidation, req.body)) return;

    if (req.body.organizationId && !(await hasOrganizationAccess(req.user.id, req.body.organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const snippet = await createSnippet(req.user.id, req.body);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json({ message: "Snippet created successfully", id: snippet.id });
});

/**
 * PATCH /snippet/{snippetId}
 * @summary Update Snippet
 * @description Updates an existing snippet's content, name, or other properties.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {string} snippetId.path.required - The unique identifier of the snippet to update
 * @param {string} organizationId.query - Optional: Organization ID if updating organization snippet
 * @param {SnippetEdit} request.body.required - Updated snippet configuration fields
 * @return {object} 200 - Snippet successfully updated
 * @return {object} 404 - Snippet not found
 */
app.patch("/:snippetId", async (req, res) => {
    if (validateSchema(res, snippetEditValidation, req.body)) return;

    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const snippet = await editSnippet(req.user.id, req.params.snippetId, req.body, organizationId);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json({ message: "Snippet updated successfully" });
});

/**
 * DELETE /snippet/{snippetId}
 * @summary Delete Snippet
 * @description Permanently removes a snippet from the user's account. This action cannot be undone.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {string} snippetId.path.required - The unique identifier of the snippet to delete
 * @param {string} organizationId.query - Optional: Organization ID if deleting organization snippet
 * @return {object} 200 - Snippet successfully deleted
 * @return {object} 404 - Snippet not found
 */
app.delete("/:snippetId", async (req, res) => {
    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const snippet = await deleteSnippet(req.user.id, req.params.snippetId, organizationId);
    if (snippet?.code) return res.status(snippet.code).json(snippet);

    res.json({ message: "Snippet deleted successfully" });
});

/**
 * PATCH /snippet/{snippetId}/reposition
 * @summary Reposition Snippet
 * @description Moves a snippet to a new position relative to another snippet.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {string} snippetId.path.required - The unique identifier of the snippet to reposition
 * @param {string} organizationId.query - Optional: Organization ID if repositioning organization snippet
 * @param {object} request.body.required - Reposition parameters (targetId, placement)
 * @return {object} 200 - Snippet successfully repositioned
 * @return {object} 400 - Cannot move snippet in that direction
 * @return {object} 404 - Snippet not found
 */
app.patch("/:snippetId/reposition", async (req, res) => {
    if (validateSchema(res, snippetRepositionValidation, req.body)) return;

    const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
    
    if (organizationId && !(await hasOrganizationAccess(req.user.id, organizationId))) {
        return res.status(403).json({ code: 403, message: "Access denied to this organization" });
    }

    const result = await repositionSnippet(req.user.id, req.params.snippetId, req.body, organizationId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Snippet repositioned successfully" });
});

module.exports = app;