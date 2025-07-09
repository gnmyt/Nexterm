const { Router } = require("express");
const { listSessions, destroySession } = require("../controllers/session");

const app = Router();

/**
 * GET /session/list
 * @summary List Active Sessions
 * @description Retrieves a list of all active sessions for the authenticated user, excluding the current session used for the request.
 * @tags Session
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of active user sessions with details
 */
app.get("/list", async (req, res) => {
    res.json(await listSessions(req.user.id, req.session.id));
});

/**
 * DELETE /session/{id}
 * @summary Destroy Session
 * @description Permanently destroys a specific session, effectively logging out that session. Useful for managing active sessions across multiple devices.
 * @tags Session
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the session to destroy
 * @return {object} 200 - Session destruction result
 */
app.delete("/:id", async (req, res) => {
    res.json(await destroySession(req.user.id, req.params.id));
});

module.exports = app;