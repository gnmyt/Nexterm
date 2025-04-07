const { Router } = require("express");
const { createServer, deleteServer, editServer, getServer, listServers, duplicateServer } = require("../controllers/server");
const { createServerValidation, updateServerValidation } = require("../validations/server");
const { validateSchema } = require("../utils/schema");

const app = Router();

app.get("/list", async (req, res) => {
    res.json(await listServers(req.user.id));
});

app.get("/:serverId", async (req, res) => {
    const server = await getServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json(server);
});

app.put("/", async (req, res) => {
    if (validateSchema(res, createServerValidation, req.body)) return;

    const server = await createServer(req.user.id, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully created", id: server.id });
});

app.delete("/:serverId", async (req, res) => {
    const server = await deleteServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully deleted" });
});

app.patch("/:serverId", async (req, res) => {
    if (validateSchema(res, updateServerValidation, req.body)) return;

    const server = await editServer(req.user.id, req.params.serverId, req.body);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully edited" });
});

app.post("/:serverId/duplicate", async (req, res) => {
    const server = await duplicateServer(req.user.id, req.params.serverId);
    if (server?.code) return res.json(server);

    res.json({ message: "Server got successfully duplicated" });
});

module.exports = app;