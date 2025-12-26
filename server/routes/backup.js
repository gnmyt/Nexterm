const { Router } = require("express");
const {
    getSettings, updateSettings, addProvider, updateProvider, deleteProvider,
    getStorageStats, createBackup, listBackups, restoreBackup,
} = require("../controllers/backup");

const app = Router();

/**
 * GET /backup/settings
 * @summary Get Backup Settings
 * @tags Backup
 * @security BearerAuth
 * @return {object} 200 - Backup settings
 */
app.get("/settings", async (req, res) => {
    try {
        res.json(await getSettings());
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * PATCH /backup/settings
 * @summary Update Backup Settings
 * @tags Backup
 * @security BearerAuth
 * @return {object} 200 - Updated settings
 */
app.patch("/settings", async (req, res) => {
    try {
        res.json(await updateSettings(req.body));
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /backup/providers
 * @summary Add Backup Provider
 * @tags Backup
 * @security BearerAuth
 * @return {object} 201 - Created provider
 */
app.post("/providers", async (req, res) => {
    try {
        const provider = await addProvider(req.body);
        res.status(201).json(provider);
    } catch (error) {
        res.status(400).json({ code: 400, message: error.message });
    }
});

/**
 * PATCH /backup/providers/:providerId
 * @summary Update Backup Provider
 * @tags Backup
 * @security BearerAuth
 * @return {object} 200 - Updated provider
 */
app.patch("/providers/:providerId", async (req, res) => {
    try {
        const result = await updateProvider(req.params.providerId, req.body);
        if (result?.code) return res.status(result.code).json(result);
        res.json(result);
    } catch (error) {
        res.status(400).json({ code: 400, message: error.message });
    }
});

/**
 * DELETE /backup/providers/:providerId
 * @summary Delete Backup Provider
 * @tags Backup
 * @security BearerAuth
 * @return {object} 200 - Success
 */
app.delete("/providers/:providerId", async (req, res) => {
    try {
        const result = await deleteProvider(req.params.providerId);
        if (result?.code) return res.status(result.code).json(result);
        res.json({ message: "Provider deleted" });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * GET /backup/storage
 * @summary Get Storage Statistics
 * @tags Backup
 * @security BearerAuth
 * @return {object} 200 - Storage stats
 */
app.get("/storage", async (req, res) => {
    try {
        res.json(getStorageStats());
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * GET /backup/providers/:providerId/backups
 * @summary List Backups for Provider
 * @tags Backup
 * @security BearerAuth
 * @return {array} 200 - List of backups
 */
app.get("/providers/:providerId/backups", async (req, res) => {
    try {
        res.json(await listBackups(req.params.providerId));
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /backup/providers/:providerId/backups
 * @summary Create Backup
 * @tags Backup
 * @security BearerAuth
 * @return {object} 201 - Created backup
 */
app.post("/providers/:providerId/backups", async (req, res) => {
    try {
        const name = await createBackup(req.params.providerId);
        res.status(201).json({ name });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

/**
 * POST /backup/providers/:providerId/backups/:backupName/restore
 * @summary Restore Backup
 * @tags Backup
 * @security BearerAuth
 * @return {object} 200 - Restore initiated
 */
app.post("/providers/:providerId/backups/:backupName/restore", async (req, res) => {
    try {
        res.json({ message: "Restore initiated, server will restart" });
        await restoreBackup(req.params.providerId, req.params.backupName);
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message });
    }
});

module.exports = app;
