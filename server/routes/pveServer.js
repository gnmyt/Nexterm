const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { getPVEServer, createPVEServer, deletePVEServer, editPVEServer, getPVEServerUnsafe } = require("../controllers/pveServer");
const { createPVEServerValidation, updatePVEServerValidation } = require("../validations/pveServer");
const { startPVEServer, shutdownPVEServer, stopPVEServer } = require("../controllers/pve");

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

app.post("/:type/:pveId/:vmId/start", async (req, res) => {
    const server = await getPVEServerUnsafe(req.user.id, req.params.pveId);
    if (server?.code) return res.json(server);


    if (req.params.type !== "qemu" && req.params.type !== "lxc")
        return res.json({ code: 400, message: "Server is not a PVE server" });

    try {
        const status = await startPVEServer(server, req.params.vmId, req.params.type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: "Server could not get started" });
    }

    res.json({ message: "Server got successfully started" });
});

app.post("/:type/:pveId/:vmId/stop", async (req, res) => {
    const server = await getPVEServerUnsafe(req.user.id, req.params.pveId);
    if (server?.code) return res.json(server);

    if (req.params.type !== "qemu" && req.params.type !== "lxc")
        return res.json({ code: 400, message: "Server is not a PVE server" });

    try {
        const status = await stopPVEServer(server, req.params.vmId, req.params.type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: "Server could not get stopped" });
    }

    res.json({ message: "Server got successfully stopped" });
});

app.post("/:type/:pveId/:vmId/shutdown", async (req, res) => {
    const server = await getPVEServerUnsafe(req.user.id, req.params.pveId);
    if (server?.code) return res.json(server);

    if (req.params.type !== "qemu" && req.params.type !== "lxc")
        return res.json({ code: 400, message: "Server is not a PVE server" });

    try {
        const status = await shutdownPVEServer(server, req.params.vmId, req.params.type);
        if (status?.code) return res.json(status);
    } catch (e) {
        return res.json({ code: 500, message: "Server could not get shutdown" });
    }

    res.json({ message: "Server got successfully shutdown" });
});

module.exports = app;