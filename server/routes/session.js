const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { listSessions, destroySession } = require("../controllers/session");

const app = Router();

app.get("/list", route({
    summary: "List active sessions",
    description: "Retrieves a list of all active sessions for the authenticated user, excluding the current session used for the request.",
    returns: objectList,
}), async (req, res) => {
    res.json(await listSessions(req.user.id, req.session.id));
});

app.delete("/:id", route({
    summary: "Destroy session",
    description: "Permanently destroys a specific session, effectively logging out that session. Useful for managing active sessions across multiple devices.",
}), async (req, res) => {
    res.json(await destroySession(req.user.id, req.params.id));
});

module.exports = app;