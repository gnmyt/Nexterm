const { Router } = require("express");
const { createEngine, listEngines, deleteEngine, regenerateToken } = require("../controllers/engine");
const controlPlane = require("../lib/controlPlane/ControlPlaneServer");
const { sendError } = require("../utils/error");
const { validateSchema } = require("../utils/schema");
const { createEngineValidation } = require("../validations/engine");

const app = Router();

/**
 * GET /engine
 * @summary List Engines
 * @description Retrieves a list of all registered engines with their current connection status, version, and remote address.
 * @tags Engine
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of engines with connection details
 */
app.get("/", async (req, res) => {
    try {
        const engines = await listEngines();

        const result = engines.map(engine => {
            const liveEngine = controlPlane.getEngineInfo(engine.id);
            return {
                id: engine.id,
                name: engine.name,
                lastConnectedAt: engine.lastConnectedAt,
                createdAt: engine.createdAt,
                connected: !!liveEngine,
                version: liveEngine?.version || null,
                remoteAddr: liveEngine?.remoteAddr || null,
            };
        });

        res.json(result);
    } catch (err) {
        sendError(res, 500, 500, err.message);
    }
});

/**
 * PUT /engine
 * @summary Create New Engine
 * @description Registers a new engine with the given name. Returns the engine details including a registration token used for engine authentication.
 * @tags Engine
 * @produces application/json
 * @security BearerAuth
 * @param {CreateEngine} request.body.required - Engine configuration
 * @return {object} 200 - Engine successfully created with registration token
 * @return {object} 400 - Invalid engine configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createEngineValidation, req.body)) return;

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

/**
 * DELETE /engine/{id}
 * @summary Delete Engine
 * @description Permanently removes an engine registration and disconnects it if currently connected.
 * @tags Engine
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the engine to delete
 * @return {object} 200 - Engine successfully deleted
 * @return {object} 404 - Engine not found
 */
app.delete("/:id", async (req, res) => {
    try {
        const engine = await deleteEngine(req.params.id);
        if (!engine) return sendError(res, 404, 404, "Engine not found");

        controlPlane.disconnectEngine(engine.id);

        res.json({ success: true });
    } catch (err) {
        sendError(res, 500, 500, err.message);
    }
});

/**
 * POST /engine/{id}/regenerate-token
 * @summary Regenerate Engine Token
 * @description Regenerates the registration token for an engine, invalidating the previous token and disconnecting the engine if currently connected.
 * @tags Engine
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the engine
 * @return {object} 200 - Engine with new registration token
 * @return {object} 404 - Engine not found
 */
app.post("/:id/regenerate-token", async (req, res) => {
    try {
        const engine = await regenerateToken(req.params.id);
        if (!engine) return sendError(res, 404, 404, "Engine not found");

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
