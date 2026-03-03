const { Router } = require("express");
const fs = require("fs");
const logger = require("../utils/logger");
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
            action: req.query.action, resource: req.query.resource,
            startDate: req.query.startDate, endDate: req.query.endDate,
            limit: parseInt(req.query.limit) || 50, offset: parseInt(req.query.offset) || 0,
        };
        const result = await auditController.getAuditLogs(req.user.id, filters);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        logger.error("Error in audit logs route", { error: error.message, stack: error.stack });
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
        logger.error("Error in audit metadata route", { error: error.message });
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
        const result = await auditController.getOrganizationAuditSettings(req.user.id, parseInt(req.params.id));
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        logger.error("Error getting organization audit settings", { organizationId: req.params.id, error: error.message });
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
        const result = await auditController.updateOrganizationAuditSettings(req.user.id, parseInt(req.params.id), req.body);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        logger.error("Error updating organization audit settings", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while updating audit settings" });
    }
});

/**
 * GET /audit/{auditLogId}/recording
 * @summary Download Session Recording
 * @description Downloads a session recording file for the specified audit log entry. Recordings are returned as gzip-compressed files in either Guacamole (.guac) or Asciicast (.cast) format depending on the session type.
 * @tags Audit
 * @produces application/octet-stream, application/json
 * @security BearerAuth
 * @param {number} auditLogId.path.required - The unique identifier of the audit log entry containing the recording
 * @return {file} 200 - Gzip-compressed session recording file
 * @return {object} 403 - Access denied to the recording
 * @return {object} 404 - Recording not found
 * @return {object} 500 - Internal server error
 */
app.get("/:auditLogId/recording", async (req, res) => {
    try {
        const auditLogId = parseInt(req.params.auditLogId);
        const result = await auditController.getRecording(req.user.id, auditLogId);
        if (result.code) return res.status(result.code).json({ message: result.message });
        
        res.setHeader("Content-Type", result.type === "cast" ? "application/json" : "application/octet-stream");
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Content-Disposition", `attachment; filename="${auditLogId}.${result.type}.gz"`);
        
        const fileStream = fs.createReadStream(result.path);
        fileStream.pipe(res);
        fileStream.on("error", (error) => {
            logger.error("Error streaming recording file", { auditLogId, error: error.message });
            if (!res.headersSent) res.status(500).json({ message: "Failed to stream recording" });
        });
    } catch (error) {
        logger.error("Error in recording route", { auditLogId: req.params.auditLogId, error: error.message });
        res.status(500).json({ message: "An error occurred while retrieving the recording" });
    }
});

module.exports = app;
