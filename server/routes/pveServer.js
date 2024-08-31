const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { getPVEServer, createPVEServer, deletePVEServer, editPVEServer } = require("../controllers/pveServer");
const { createPVEServerValidation, updatePVEServerValidation } = require("../validations/pveServer");

const app = Router();

app.get("/:serverId", async (req, res) => {
    const server = await getPVEServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json(server);
});

app.put("/", async (req, res) => {
    if (validateSchema(res, createPVEServerValidation, req.body)) return;

    const server = await createPVEServer(req.user.id, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully created", id: server.id });
});

app.delete("/:serverId", async (req, res) => {
    const server = await deletePVEServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully deleted" });
});

app.patch("/:serverId", async (req, res) => {
    if (validateSchema(res, updatePVEServerValidation, req.body)) return;

    const server = await editPVEServer(req.user.id, req.params.serverId, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully edited" });
});

module.exports = app;