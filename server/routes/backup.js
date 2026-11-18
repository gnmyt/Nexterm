const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { updateBackupSettingsValidation, createBackupProviderValidation, updateBackupProviderValidation } = require("../validations/backup");
const fs = require("fs");
const path = require("path");
const {
    getSettings, updateSettings, addProvider, updateProvider, deleteProvider,
    getStorageStats, createBackup, listBackups, restoreBackup,
} = require("../controllers/backup");

const DATA_DIR = path.join(__dirname, "../../data");
const VALID_TYPES = ["recordings", "logs"];

const app = Router();

const validateType = (type) => VALID_TYPES.includes(type);
const getFilePath = (type, filename) => path.join(DATA_DIR, type, path.basename(filename));

app.get("/files/:type", route({
    summary: "List files in recordings or logs directory",
    returns: objectList,
}), (req, res) => {
    const { type } = req.params;
    if (!validateType(type)) return res.status(400).json({ message: "Invalid type" });
    
    const dirPath = path.join(DATA_DIR, type);
    if (!fs.existsSync(dirPath)) return res.json([]);
    
    const files = fs.readdirSync(dirPath)
        .filter(f => !f.startsWith("."))
        .map(name => {
            const stat = fs.statSync(path.join(dirPath, name));
            return { name, size: stat.size, modified: stat.mtime };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json(files);
});

app.delete("/files/:type/:filename", route({
    summary: "Delete a file from recordings or logs",
}), (req, res) => {
    const { type, filename } = req.params;
    if (!validateType(type)) return res.status(400).json({ message: "Invalid type" });
    
    const filePath = getFilePath(type, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    
    fs.unlinkSync(filePath);
    res.json({ message: "File deleted" });
});

app.get("/settings", route({
    summary: "Get backup settings",
}), async (req, res) => {
    try {
        res.json(await getSettings());
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.patch("/settings", route({
    summary: "Update backup settings",
    body: updateBackupSettingsValidation,
}), async (req, res) => {
    try {
        res.json(await updateSettings(req.body));
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/providers", route({
    summary: "Add backup provider",
    status: 201,
    body: createBackupProviderValidation,
}), async (req, res) => {
    try {
        const provider = await addProvider(req.body);
        res.status(201).json(provider);
    } catch (error) {
        res.status(400).json({ code: 400, message: error.message });
    }
});

app.patch("/providers/:providerId", route({
    summary: "Update backup provider",
    body: updateBackupProviderValidation,
}), async (req, res) => {
    try {
        const result = await updateProvider(req.params.providerId, req.body);
        if (result?.code) return res.status(result.code).json(result);
        res.json(result);
    } catch (error) {
        res.status(400).json({ code: 400, message: error.message });
    }
});

app.delete("/providers/:providerId", route({
    summary: "Delete backup provider",
}), async (req, res) => {
    try {
        const result = await deleteProvider(req.params.providerId);
        if (result?.code) return res.status(result.code).json(result);
        res.json({ message: "Provider deleted" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/storage", route({
    summary: "Get storage statistics",
}), async (req, res) => {
    try {
        res.json(getStorageStats());
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.get("/providers/:providerId/backups", route({
    summary: "List backups for provider",
    returns: objectList,
}), async (req, res) => {
    try {
        res.json(await listBackups(req.params.providerId));
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/providers/:providerId/backups", route({
    summary: "Create backup",
    status: 201,
}), async (req, res) => {
    try {
        const name = await createBackup(req.params.providerId);
        res.status(201).json({ name });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

app.post("/providers/:providerId/backups/:backupName/restore", route({
    summary: "Restore backup",
}), async (req, res) => {
    try {
        res.json({ message: "Restore initiated, server will restart" });
        await restoreBackup(req.params.providerId, req.params.backupName);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
