const express = require("express");
const { getFTSStatus } = require("../controllers/account");

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

module.exports = app;