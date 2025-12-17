const { Router } = require("express");
const { getServerMonitoring, getAllServersMonitoring, getIntegrationMonitoring } = require("../controllers/monitoring");

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
