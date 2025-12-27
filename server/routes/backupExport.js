const { Router } = require("express");
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

/**
 * GET /backup/export/database
 * @summary Export the database file
 * @tags Backup
 * @param {string} token.query.required - Authentication token
 * @return {file} 200 - Database file download
 * @return {object} 404 - Database not found
 */
app.get("/database", authenticateDownload, (req, res) => {
    const dbPath = path.join(DATA_DIR, "nexterm.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ message: "Database not found" });
    streamFile(res, dbPath, `nexterm-${Date.now()}.db`);
});

/**
 * GET /backup/export/{type}/{filename}
 * @summary Download a specific file from recordings or logs
 * @tags Backup
 * @param {string} type.path.required - File type (recordings or logs)
 * @param {string} filename.path.required - Name of the file to download
 * @param {string} token.query.required - Authentication token
 * @return {file} 200 - File download
 * @return {object} 400 - Invalid type
 * @return {object} 404 - File not found
 */
app.get("/:type/:filename", authenticateDownload, (req, res) => {
    const { type, filename } = req.params;
    if (type !== "recordings" && type !== "logs") return res.status(400).json({ message: "Invalid type" });
    
    const safeName = path.basename(filename);
    const filePath = path.join(DATA_DIR, type, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    
    streamFile(res, filePath, safeName);
});

module.exports = app;
