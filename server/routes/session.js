const { Router } = require("express");
const { listSessions, destroySession } = require("../controllers/session");

const app = Router();

app.get("/list", async (req, res) => {
    res.json(await listSessions(req.user.id, req.session.id));
});

app.delete("/:id", async (req, res) => {
    res.json(await destroySession(req.user.id, req.params.id));
});

module.exports = app;