const express = require("express");
const { route } = require("../utils/route");
const { getFTSStatus } = require("../controllers/account");
const packageJson = require("../../package.json");
const { isDemoMode, DEMO_SETTINGS } = require("../utils/demoMode");

const app = express.Router();

app.get("/is-fts", route({
    summary: "Check status",
    description: "Determines if the Nexterm server requires initial setup. This endpoint is used during the first-time setup process to check if the server has been configured with initial user accounts and settings.",
}), (req, res) => {
    getFTSStatus()
        .then(status => res.json(status))
        .catch(err => res.status(500).json({ error: err.message }));
});

app.get("/version", route({
    summary: "Get version",
    description: "Returns the current Nexterm server version.",
}), (req, res) => {
    res.json({ version: packageJson.version });
});

app.get("/demo", route({
    summary: "Get demo status",
    description: "Returns whether the server runs in demo mode and how long guest sessions last.",
}), (req, res) => {
    res.json(isDemoMode() ? { enabled: true, guestTtlMinutes: DEMO_SETTINGS.guestTtlMinutes } : { enabled: false });
});

module.exports = app;