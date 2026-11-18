const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { createEngine, listEngines, deleteEngine, regenerateToken } = require("../controllers/engine");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { sendError } = require("../utils/error");
const { createEngineValidation } = require("../validations/engine");

const app = Router();

app.get("/", route({
    summary: "List engines",
    description: "Retrieves a list of all registered engines with their current connection status, version, and remote address.",
    returns: objectList,
}), async (req, res) => {
    try {
        const engines = await listEngines();

        const result = engines.map(engine => {
            const liveEngine = controlPlane.getEngineInfo(engine.id);
            return {
                id: engine.id,
                name: engine.name,
                isLocal: !!engine.isLocal,
                lastConnectedAt: engine.lastConnectedAt,
                createdAt: engine.createdAt,
                connected: !!liveEngine,
                version: liveEngine?.version || null,
                remoteAddr: liveEngine?.remoteAddr || null,
                encrypted: liveEngine?.encrypted || false,
            };
        });

        res.json(result);
    } catch (err) {
        sendError(res, 500, 500, err.message);
    }
});

app.put("/", route({
    summary: "Create new engine",
    description: "Registers a new engine with the given name. Returns the engine details including a registration token used for engine authentication.",
    body: createEngineValidation,
}), async (req, res) => {
    try {
        const engine = await createEngine(req.body.name);
        res.json({
            id: engine.id,
            name: engine.name,
            registrationToken: engine.registrationToken,
            createdAt: engine.createdAt,
            connected: false,
            version: null,
        });
    } catch (err) {
        sendError(res, 500, 500, err.message);
    }
});

app.delete("/:id", route({
    summary: "Delete engine",
    description: "Permanently removes an engine registration and disconnects it if currently connected.",
}), async (req, res) => {
    try {
        const engine = await deleteEngine(req.params.id);
        if (!engine) return sendError(res, 404, 404, "Engine not found");
        if (engine.error === "local") return sendError(res, 403, 403, "Cannot delete the local engine");

        controlPlane.disconnectEngine(engine.id);

        res.json({ success: true });
    } catch (err) {
        sendError(res, 500, 500, err.message);
    }
});

app.post("/:id/regenerate-token", route({
    summary: "Regenerate engine token",
    description: "Regenerates the registration token for an engine, invalidating the previous token and disconnecting the engine if currently connected.",
}), async (req, res) => {
    try {
        const engine = await regenerateToken(req.params.id);
        if (!engine) return sendError(res, 404, 404, "Engine not found");
        if (engine.error === "local") return sendError(res, 403, 403, "Cannot regenerate token for the local engine");

        controlPlane.disconnectEngine(req.params.id);

        res.json({
            id: engine.id,
            name: engine.name,
            registrationToken: engine.registrationToken,
        });
    } catch (err) {
        sendError(res, 500, 500, err.message);
    }
});

module.exports = app;
