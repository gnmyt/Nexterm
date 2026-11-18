const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const fs = require("fs");
const path = require("path");
const { authenticateDownload } = require("../middlewares/auth");

const DATA_DIR = path.join(__dirname, "../../data");

const app = Router();

const streamFile = (res, filePath, filename) => {
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
};

app.get("/database", authenticateDownload, route({
    summary: "Export the database file",
    query: Joi.object({
        token: Joi.string().required().description("Authentication token"),
    }),
}), (req, res) => {
    const dbPath = path.join(DATA_DIR, "nexterm.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ message: "Database not found" });
    streamFile(res, dbPath, `nexterm-${Date.now()}.db`);
});

app.get("/:type/:filename", authenticateDownload, route({
    summary: "Download a specific file from recordings or logs",
    query: Joi.object({
        token: Joi.string().required().description("Authentication token"),
    }),
}), (req, res) => {
    const { type, filename } = req.params;
    if (type !== "recordings" && type !== "logs") return res.status(400).json({ message: "Invalid type" });
    
    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, type, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    
    streamFile(res, filePath, safeName);
});

module.exports = app;
