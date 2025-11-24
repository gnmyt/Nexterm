const { Router } = require("express");
const { 
    createTag, 
    listTags, 
    updateTag, 
    deleteTag, 
    assignTagToEntry, 
    removeTagFromEntry,
    getEntryTags 
} = require("../controllers/tag");

const app = Router();

/**
 * GET /tag/list
 * @summary List User Tags
 * @description Retrieves a list of all tags created by the authenticated user
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user tags
 */
app.get("/list", async (req, res) => {
    const tags = await listTags(req.user.id);
    res.json(tags);
});

/**
 * PUT /tag
 * @summary Create New Tag
 * @description Creates a new tag with a name and color
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @param {object} request.body.required - Tag configuration including name and color
 * @return {object} 200 - Tag successfully created
 * @return {object} 400 - Invalid tag configuration
 * @return {object} 409 - Tag with this name already exists
 */
app.put("/", async (req, res) => {
    const tag = await createTag(req.user.id, req.body);
    if (tag?.code) return res.status(tag.code).json(tag);

    res.json({ message: "Tag successfully created", id: tag.id });
});

/**
 * PATCH /tag/{tagId}
 * @summary Update Tag
 * @description Updates a tag's name or color
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @param {string} tagId.path.required - The unique identifier of the tag
 * @param {object} request.body.required - Updated tag configuration
 * @return {object} 200 - Tag successfully updated
 * @return {object} 404 - Tag not found
 * @return {object} 403 - Permission denied
 * @return {object} 409 - Tag name conflict
 */
app.patch("/:tagId", async (req, res) => {
    const result = await updateTag(req.user.id, req.params.tagId, req.body);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully updated" });
});

/**
 * DELETE /tag/{tagId}
 * @summary Delete Tag
 * @description Permanently removes a tag and all its assignments
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @param {string} tagId.path.required - The unique identifier of the tag to delete
 * @return {object} 200 - Tag successfully deleted
 * @return {object} 404 - Tag not found
 * @return {object} 403 - Permission denied
 */
app.delete("/:tagId", async (req, res) => {
    const result = await deleteTag(req.user.id, req.params.tagId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully deleted" });
});

/**
 * POST /tag/{tagId}/assign/{entryId}
 * @summary Assign Tag to Entry
 * @description Assigns a tag to a specific entry
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @param {string} tagId.path.required - The unique identifier of the tag
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - Tag successfully assigned
 * @return {object} 404 - Tag or entry not found
 * @return {object} 403 - Permission denied
 * @return {object} 409 - Entry already has this tag
 */
app.post("/:tagId/assign/:entryId", async (req, res) => {
    const result = await assignTagToEntry(req.user.id, req.params.entryId, req.params.tagId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully assigned to entry" });
});

/**
 * DELETE /tag/{tagId}/assign/{entryId}
 * @summary Remove Tag from Entry
 * @description Removes a tag assignment from a specific entry
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @param {string} tagId.path.required - The unique identifier of the tag
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {object} 200 - Tag successfully removed from entry
 * @return {object} 404 - Tag or entry not found
 * @return {object} 403 - Permission denied
 */
app.delete("/:tagId/assign/:entryId", async (req, res) => {
    const result = await removeTagFromEntry(req.user.id, req.params.entryId, req.params.tagId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully removed from entry" });
});

/**
 * GET /tag/entry/{entryId}
 * @summary Get Entry Tags
 * @description Retrieves all tags assigned to a specific entry
 * @tags Tag
 * @produces application/json
 * @security BearerAuth
 * @param {string} entryId.path.required - The unique identifier of the entry
 * @return {array} 200 - List of tags assigned to the entry
 * @return {object} 404 - Entry not found
 * @return {object} 403 - Permission denied
 */
app.get("/entry/:entryId", async (req, res) => {
    const tags = await getEntryTags(req.user.id, req.params.entryId);
    if (tags?.code) return res.status(tags.code).json(tags);

    res.json(tags);
});

module.exports = app;
