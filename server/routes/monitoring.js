const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList } = require("../validations/common");
const { getServerMonitoring, getAllServersMonitoring, getIntegrationMonitoring, getMonitoringSettings, updateMonitoringSettings } = require("../controllers/monitoring");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");
const { updateMonitoringSettingsValidation } = require("../validations/monitoring");

const app = Router();

app.get("/", route({
    summary: "Get all servers monitoring",
    description: "Retrieves monitoring data for all servers accessible by the authenticated user, including uptime status and performance metrics.",
    returns: objectList,
}), async (req, res) => {
    const result = await getAllServersMonitoring(req.user.id, { includeHistory: true });
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

app.get("/settings/global", requirePermission(Permission.SETTINGS_MONITORING), route({
    summary: "Get monitoring settings",
    description: "Retrieves the global monitoring configuration settings.",
}), async (req, res) => {
    try {
        const settings = await getMonitoringSettings();
        if (settings?.code) return res.status(settings.code).json(settings);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.patch("/settings/global", requirePermission(Permission.SETTINGS_MONITORING), route({
    summary: "Update monitoring settings",
    description: "Updates global monitoring configuration settings.",
    body: updateMonitoringSettingsValidation,
}), async (req, res) => {
    try {
        
        const updatedSettings = await updateMonitoringSettings(req.body);
        if (updatedSettings?.code) return res.status(updatedSettings.code).json(updatedSettings);
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/integration/:integrationId", route({
    summary: "Get integration monitoring",
    description: "Retrieves monitoring data for a Proxmox integration.",
    query: Joi.object({
        timeRange: Joi.string().allow("").description("Time range for monitoring data (1h, 6h, 24h) - defaults to 1h"),
    }),
}), async (req, res) => {
    const timeRange = req.query.timeRange || "1h";
    const result = await getIntegrationMonitoring(req.user.id, req.params.integrationId, timeRange);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

app.get("/:serverId", route({
    summary: "Get server monitoring",
    description: "Retrieves detailed monitoring data for a specific server including historical performance metrics, uptime statistics, and health status over a specified time range.",
    query: Joi.object({
        timeRange: Joi.string().allow("").description("Time range for monitoring data (e.g., 1h, 24h, 7d) - defaults to 1h"),
    }),
}), async (req, res) => {
    const timeRange = req.query.timeRange || "1h";
    const result = await getServerMonitoring(req.user.id, req.params.serverId, timeRange);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

module.exports = app;
