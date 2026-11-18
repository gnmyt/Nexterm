const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList, created } = require("../validations/common");
const { folderCreationValidation, folderEditValidation } = require("../validations/folder");
const { createFolder, deleteFolder, listFolders, getFolderById, editFolder } = require("../controllers/folder");

const app = Router();


app.get("/list", route({
    summary: "List user folders",
    description: "Retrieves a list of all folders created by the authenticated user for organizing servers and resources.",
    returns: objectList,
}), async (req, res) => {
    res.json(await listFolders(req.user.id));
});

app.get("/:folderId", route({
    summary: "Get folder",
    description: "Returns a folder with its identity profiles and the settings it inherits from its parent folders.",
    query: Joi.object({ protocol: Joi.string().allow("").description("Only resolve the inherited settings for this protocol") }),
    returns: Joi.object({
        id: Joi.number().integer().required(),
        name: Joi.string().required(),
        accountId: Joi.number().integer().allow(null),
        organizationId: Joi.number().integer().allow(null),
        parentId: Joi.number().integer().allow(null),
        position: Joi.number().integer(),
        config: Joi.object().unknown(true),
        identities: Joi.array().items(Joi.number().integer()),
    }).unknown(true),
}), async (req, res) => {
    const folder = await getFolderById(req.user.id, req.params.folderId, req.query.protocol || null);
    if (folder?.code) return res.json(folder);

    res.json(folder);
});

app.put("/", route({
    summary: "Create new folder",
    description: "Creates a new folder for organizing servers and other resources. Folders help users categorize and manage their connections.",
    body: folderCreationValidation,
    returns: created,
}), async (req, res) => {
    const folder = await createFolder(req.user.id, req.body);
    if (folder?.code) return res.json(folder);

    res.json({ message: "Folder has been successfully created", id: folder.id });
});

app.patch("/:folderId", route({
    summary: "Update folder",
    description: "Updates an existing folder's configuration such as name or other properties.",
    body: folderEditValidation,
}), async (req, res) => {
    const response = await editFolder(req.user.id, req.params.folderId, req.body);
    if (response) return res.json(response);

    res.json({ message: "Folder has been successfully edited" });
});

app.delete("/:folderId", route({
    summary: "Delete folder",
    description: "Permanently removes a folder from the user's account. Any servers within the folder may be moved to a default location.",
}), async (req, res) => {
    const response = await deleteFolder(req.user.id, req.params.folderId);
    if (response) return res.json(response);

    res.json({ message: "Folder has been successfully deleted" });
});


module.exports = app;
