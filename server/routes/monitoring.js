const { Router } = require("express");
const { getServerMonitoring, getAllServersMonitoring, getIntegrationMonitoring, getMonitoringSettings, updateMonitoringSettings } = require("../controllers/monitoring");
const { isAdmin } = require("../middlewares/permission");
const { validateSchema } = require("../utils/schema");
const { updateMonitoringSettingsValidation } = require("../validations/monitoring");

const app = Router();

/**
 * GET /monitoring
 * @summary Get All Servers Monitoring
 * @description Retrieves monitoring data for all servers accessible by the authenticated user, including uptime status and performance metrics.
 * @tags Monitoring
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - Monitoring data for all user servers
 * @return {object} 403 - Access denied
 */
app.get("/", async (req, res) => {
    const result = await getAllServersMonitoring(req.user.id);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

/**
 * GET /monitoring/settings/global
 * @summary Get Monitoring Settings
 * @description Retrieves the global monitoring configuration settings. Admin access required.
 * @tags Monitoring
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Monitoring settings configuration
 * @return {object} 403 - Admin access required
 */
app.get("/settings/global", isAdmin, async (req, res) => {
    try {
        const settings = await getMonitoringSettings();
        if (settings?.code) return res.status(settings.code).json(settings);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /monitoring/settings/global
 * @summary Update Monitoring Settings
 * @description Updates global monitoring configuration settings. Admin access required.
 * @tags Monitoring
 * @produces application/json
 * @security BearerAuth
 * @param {UpdateMonitoringSettings} request.body.required - Updated monitoring settings
 * @return {object} 200 - Updated monitoring settings
 * @return {object} 403 - Admin access required
 */
app.patch("/settings/global", isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, updateMonitoringSettingsValidation, req.body)) return;
        
        const updatedSettings = await updateMonitoringSettings(req.body);
        if (updatedSettings?.code) return res.status(updatedSettings.code).json(updatedSettings);
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /monitoring/integration/{integrationId}
 * @summary Get Integration Monitoring
 * @description Retrieves monitoring data for a Proxmox integration.
 * @tags Monitoring
 * @produces application/json
 * @security BearerAuth
 * @param {string} integrationId.path.required - The unique identifier of the integration
 * @param {string} timeRange.query - Time range for monitoring data (1h, 6h, 24h) - defaults to 1h
 * @return {object} 200 - Integration monitoring data
 * @return {object} 404 - Integration not found
 */
app.get("/integration/:integrationId", async (req, res) => {
    const timeRange = req.query.timeRange || "1h";
    const result = await getIntegrationMonitoring(req.user.id, req.params.integrationId, timeRange);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

/**
 * GET /monitoring/{serverId}
 * @summary Get Server Monitoring
 * @description Retrieves detailed monitoring data for a specific server including historical performance metrics, uptime statistics, and health status over a specified time range.
 * @tags Monitoring
 * @produces application/json
 * @security BearerAuth
 * @param {string} serverId.path.required - The unique identifier of the server
 * @param {string} timeRange.query - Time range for monitoring data (e.g., 1h, 24h, 7d) - defaults to 1h
 * @return {object} 200 - Server monitoring data
 * @return {object} 404 - Server not found
 */
app.get("/:serverId", async (req, res) => {
    const timeRange = req.query.timeRange || "1h";
    const result = await getServerMonitoring(req.user.id, req.params.serverId, timeRange);
    if (result?.code) return res.status(result.code).json(result);

    res.json(result);
});

module.exports = app;
