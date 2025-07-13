const { Router } = require("express");
const auditController = require("../controllers/audit");
const { getAuditLogsValidation, updateOrganizationAuditSettingsValidation } = require("../validations/audit");
const { validateSchema } = require("../utils/schema");

const app = Router();

/**
 * GET /audit/logs
 * @summary Get Audit Logs
 * @description Retrieves audit logs with optional filtering by organization, action, resource, date range, and pagination support.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {number} organizationId.query - Filter by organization ID
 * @param {string} action.query - Filter by specific action type
 * @param {string} resource.query - Filter by resource type
 * @param {string} startDate.query - Filter logs from this date (ISO 8601 format)
 * @param {string} endDate.query - Filter logs until this date (ISO 8601 format)
 * @param {number} limit.query - Maximum number of logs to return (default: 50)
 * @param {number} offset.query - Number of logs to skip for pagination (default: 0)
 * @return {object} 200 - Audit logs matching the specified criteria
 * @return {object} 400 - Invalid filter parameters
 */
app.get("/logs", async (req, res) => {
    try {
        if (validateSchema(res, getAuditLogsValidation, req.query)) return;

        const filters = {
            organizationId: req.query.organizationId === 'personal' ? 'personal' : (req.query.organizationId ? parseInt(req.query.organizationId) : null),
            action: req.query.action,
            resource: req.query.resource,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0,
        };

        const result = await auditController.getAuditLogs(req.user.id, filters);
        if (result.code) return res.status(result.code).json({ message: result.message });

        res.json(result);
    } catch (error) {
        console.error("Error in audit logs route:", error);
        res.status(500).json({ message: "An error occurred while retrieving audit logs" });
    }
});

/**
 * GET /audit/metadata
 * @summary Get Audit Metadata
 * @description Retrieves metadata information about available audit log types, actions, and resources for filtering purposes.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @return {object} 200 - Audit metadata including available actions and resource types
 * @return {object} 500 - Internal server error
 */
app.get("/metadata", async (req, res) => {
    try {
        res.json(await auditController.getAuditMetadata());
    } catch (error) {
        console.error("Error in audit metadata route:", error);
        res.status(500).json({ message: "An error occurred while retrieving audit metadata" });
    }
});

/**
 * GET /audit/organizations/{id}/settings
 * @summary Get Organization Audit Settings
 * @description Retrieves audit logging configuration settings for a specific organization, including retention policies and enabled audit features.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @return {object} 200 - Organization audit settings configuration
 * @return {object} 404 - Organization not found or access denied
 * @return {object} 500 - Internal server error
 */
app.get("/organizations/:id/settings", async (req, res) => {
    try {
        const organizationId = parseInt(req.params.id);

        const result = await auditController.getOrganizationAuditSettings(req.user.id, organizationId);

        if (result.code) return res.status(result.code).json({ message: result.message });

        res.json(result);
    } catch (error) {
        console.error("Error getting organization audit settings:", error);
        res.status(500).json({ message: "An error occurred while retrieving audit settings" });
    }
});

/**
 * PATCH /audit/organizations/{id}/settings
 * @summary Update Organization Audit Settings
 * @description Updates audit logging configuration settings for a specific organization, such as retention policies and audit feature toggles.
 * @tags Audit
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the organization
 * @param {UpdateOrganizationAuditSettings} request.body.required - Updated audit settings configuration
 * @return {object} 200 - Audit settings successfully updated
 * @return {object} 400 - Invalid settings configuration
 * @return {object} 404 - Organization not found or access denied
 * @return {object} 500 - Internal server error
 */
app.patch("/organizations/:id/settings", async (req, res) => {
    try {
        if (validateSchema(res, updateOrganizationAuditSettingsValidation, req.body)) return;

        const organizationId = parseInt(req.params.id);

        const result = await auditController.updateOrganizationAuditSettings(req.user.id, organizationId, req.body);

        if (result.code) return res.status(result.code).json({ message: result.message });

        res.json(result);
    } catch (error) {
        console.error("Error updating organization audit settings:", error);
        res.status(500).json({ message: "An error occurred while updating audit settings" });
    }
});

module.exports = app;
