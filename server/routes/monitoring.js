const { Router } = require("express");
const { getServerMonitoring, getAllServersMonitoring } = require("../controllers/monitoring");

const app = Router();

app.get("/", async (req, res) => {
    const result = await getAllServersMonitoring(req.user.id);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

app.get("/:serverId", async (req, res) => {
    const timeRange = req.query.timeRange || "1h";
    const result = await getServerMonitoring(req.user.id, req.params.serverId, timeRange);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

module.exports = app;
