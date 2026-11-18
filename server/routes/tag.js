const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList, created } = require("../validations/common");
const { createTagValidation, updateTagValidation } = require("../validations/tag");
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

const tagResponse = Joi.object({
    id: Joi.number().integer().required(),
    accountId: Joi.number().integer().required(),
    name: Joi.string().required(),
    color: Joi.string().required(),
}).unknown(true);

app.get("/list", route({
    summary: "List user tags",
    description: "Retrieves a list of all tags created by the authenticated user",
    returns: Joi.array().items(tagResponse),
}), async (req, res) => {
    const tags = await listTags(req.user.id);
    res.json(tags);
});

app.put("/", route({
    summary: "Create new tag",
    description: "Creates a new tag with a name and color",
    body: createTagValidation,
    returns: created,
}), async (req, res) => {
    const tag = await createTag(req.user.id, req.body);
    if (tag?.code) return res.status(tag.code).json(tag);

    res.json({ message: "Tag successfully created", id: tag.id });
});

app.patch("/:tagId", route({
    summary: "Update tag",
    description: "Updates a tag's name or color",
    body: updateTagValidation,
}), async (req, res) => {
    const result = await updateTag(req.user.id, req.params.tagId, req.body);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully updated" });
});

app.delete("/:tagId", route({
    summary: "Delete tag",
    description: "Permanently removes a tag and all its assignments",
}), async (req, res) => {
    const result = await deleteTag(req.user.id, req.params.tagId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully deleted" });
});

app.post("/:tagId/assign/:entryId", route({
    summary: "Assign tag to entry",
    description: "Assigns a tag to a specific entry",
}), async (req, res) => {
    const result = await assignTagToEntry(req.user.id, req.params.entryId, req.params.tagId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully assigned to entry" });
});

app.delete("/:tagId/assign/:entryId", route({
    summary: "Remove tag from entry",
    description: "Removes a tag assignment from a specific entry",
}), async (req, res) => {
    const result = await removeTagFromEntry(req.user.id, req.params.entryId, req.params.tagId);
    if (result?.code) return res.status(result.code).json(result);

    res.json({ message: "Tag successfully removed from entry" });
});

app.get("/entry/:entryId", route({
    summary: "Get entry tags",
    description: "Retrieves all tags assigned to a specific entry",
    returns: objectList,
}), async (req, res) => {
    const tags = await getEntryTags(req.user.id, req.params.entryId);
    if (tags?.code) return res.status(tags.code).json(tags);

    res.json(tags);
});

module.exports = app;
