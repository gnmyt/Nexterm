const express = require("express");
const { getFTSStatus } = require("../controllers/account");

const app = express.Router();

// Checks if the server is not setup yet (First Time Setup)
app.get("/is-fts", (req, res) => {
    getFTSStatus()
        .then(status => res.json(status))
        .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = app;