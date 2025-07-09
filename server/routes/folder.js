const { Router } = require("express");
const { folderCreationValidation, folderEditValidation } = require("../validations/folder");
const { createFolder, deleteFolder, listFolders, editFolder } = require("../controllers/folder");
const { validateSchema } = require("../utils/schema");

const app = Router();

/**
 * GET /folder/list
 * @summary List User Folders
 * @description Retrieves a list of all folders created by the authenticated user for organizing servers and resources.
 * @tags Folder
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user folders
 */
app.get("/list", async (req, res) => {
    res.json(await listFolders(req.user.id));
});

/**
 * PUT /folder
 * @summary Create New Folder
 * @description Creates a new folder for organizing servers and other resources. Folders help users categorize and manage their connections.
 * @tags Folder
 * @produces application/json
 * @security BearerAuth
 * @param {FolderCreation} request.body.required - Folder configuration including name and optional properties
 * @return {object} 200 - Folder successfully created with new folder ID
 * @return {object} 400 - Invalid folder configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, folderCreationValidation, req.body)) return;

    const folder = await createFolder(req.user.id, req.body);
    if (folder?.code) return res.json(folder);

    res.json({ message: "Folder has been successfully created", id: folder.id });
});

/**
 * PATCH /folder/{folderId}
 * @summary Update Folder
 * @description Updates an existing folder's configuration such as name or other properties.
 * @tags Folder
 * @produces application/json
 * @security BearerAuth
 * @param {string} folderId.path.required - The unique identifier of the folder to update
 * @param {FolderEdit} request.body.required - Updated folder configuration fields
 * @return {object} 200 - Folder successfully updated
 * @return {object} 404 - Folder not found
 */
app.patch("/:folderId", async (req, res) => {
    if (validateSchema(res, folderEditValidation, req.body)) return;

    const response = await editFolder(req.user.id, req.params.folderId, req.body);
    if (response) return res.json(response);

    res.json({ message: "Folder has been successfully edited" });
});

/**
 * DELETE /folder/{folderId}
 * @summary Delete Folder
 * @description Permanently removes a folder from the user's account. Any servers within the folder may be moved to a default location.
 * @tags Folder
 * @produces application/json
 * @security BearerAuth
 * @param {string} folderId.path.required - The unique identifier of the folder to delete
 * @return {object} 200 - Folder successfully deleted
 * @return {object} 404 - Folder not found
 */
app.delete("/:folderId", async (req, res) => {
    const response = await deleteFolder(req.user.id, req.params.folderId);
    if (response) return res.json(response);

    res.json({ message: "Folder has been successfully deleted" });
});


module.exports = app;
