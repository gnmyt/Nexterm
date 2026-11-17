const express = require("express");
const { getFTSStatus } = require("../controllers/account");
const packageJson = require("../../package.json");
const { isDemoMode, DEMO_SETTINGS } = require("../utils/demoMode");

const app = express.Router();

/**
 * GET /service/is-fts
 * @summary Check Status
 * @description Determines if the Nexterm server requires initial setup. This endpoint is used during the first-time setup process to check if the server has been configured with initial user accounts and settings.
 * @tags Service
 * @produces application/json
 * @return {boolean} 200 - First Time Setup status information
 */
app.get("/is-fts", (req, res) => {
    getFTSStatus()
        .then(status => res.json(status))
        .catch(err => res.status(500).json({ error: err.message }));
});

/**
 * GET /service/version
 * @summary Get Version
 * @description Returns the current Nexterm server version.
 * @tags Service
 * @produces application/json
 * @return {object} 200 - Version information
 */
app.get("/version", (req, res) => {
    res.json({ version: packageJson.version });
});

/**
 * GET /service/demo
 * @summary Get Demo Status
 * @description Returns whether the server runs in demo mode and how long guest sessions last.
 * @tags Service
 * @produces application/json
 * @return {object} 200 - Demo mode status
 */
app.get("/demo", (req, res) => {
    res.json(isDemoMode() ? { enabled: true, guestTtlMinutes: DEMO_SETTINGS.guestTtlMinutes } : { enabled: false });
});

module.exports = app;