const { Router } = require("express");
const { folderCreationValidation, folderRenameValidation } = require("../validations/folder");
const { createFolder, deleteFolder, renameFolder, listFolders } = require("../controllers/folder");
const { validateSchema } = require("../utils/schema");

const app = Router();

app.get("/list", async (req, res) => {
    res.json(await listFolders(req.user.id));
});

app.put("/", async (req, res) => {
    if (validateSchema(res, folderCreationValidation, req.body)) return;

    const folder = await createFolder(req.user.id, req.body);
    if (folder?.code) return res.json(folder);

    res.json({ message: "Folder has been successfully created", id: folder.id });
});

app.patch("/:folderId/rename", async (req, res) => {
    if (validateSchema(res, folderRenameValidation, req.body)) return;

    const response = await renameFolder(req.user.id, req.params.folderId, req.body.name);
    if (response) return res.json(response);

    res.json({ message: "Folder has been successfully renamed" });
});

app.delete("/:folderId", async (req, res) => {
    const response = await deleteFolder(req.user.id, req.params.folderId);
    if (response) return res.json(response);

    res.json({ message: "Folder has been successfully deleted" });
});


module.exports = app;
