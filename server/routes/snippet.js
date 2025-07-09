const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { createSnippet, deleteSnippet, editSnippet, getSnippet, listSnippets } = require("../controllers/snippet");
const { snippetCreationValidation, snippetEditValidation } = require("../validations/snippet");

const app = Router();

/**
 * GET /snippet/list
 * @summary List User Snippets
 * @description Retrieves a list of all code snippets created by the authenticated user for reusable commands and scripts.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user snippets
 */
app.get("/list", async (req, res) => {
    res.json(await listSnippets(req.user.id));
});

/**
 * GET /snippet/{snippetId}
 * @summary Get Snippet Details
 * @description Retrieves detailed information about a specific snippet including its content and metadata.
 * @tags Snippet
 * @produces application/json
 * @security BearerAuth
 * @param {string} snippetId.path.required - The unique identifier of the snippet
 * @return {object} 200 - Snippet details
 * @return {object} 404 - Snippet not found
 */
app.get("/:snippetId", async (req, res) => {
    const snippet = await getSnippet(req.user.id, req.params.snippetId);
    if (snippet?.code) return res.json(snippet);

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

    const snippet = await createSnippet(req.user.id, req.body);
    if (snippet?.code) return res.json(snippet);

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
 * @param {SnippetEdit} request.body.required - Updated snippet configuration fields
 * @return {object} 200 - Snippet successfully updated
 * @return {object} 404 - Snippet not found
 */
app.patch("/:snippetId", async (req, res) => {
    if (validateSchema(res, snippetEditValidation, req.body)) return;

    const snippet = await editSnippet(req.user.id, req.params.snippetId, req.body);
    if (snippet?.code) return res.json(snippet);

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
 * @return {object} 200 - Snippet successfully deleted
 * @return {object} 404 - Snippet not found
 */
app.delete("/:snippetId", async (req, res) => {
    const snippet = await deleteSnippet(req.user.id, req.params.snippetId);
    if (snippet?.code) return res.json(snippet);

    res.json({ message: "Snippet deleted successfully" });
});

module.exports = app;