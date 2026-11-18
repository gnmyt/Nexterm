const { Router } = require("express");
const { route } = require("../utils/route");
const fs = require("fs");
const logger = require("../utils/logger");
const auditController = require("../controllers/audit");
const { getAuditLogsValidation, updateOrganizationAuditSettingsValidation } = require("../validations/audit");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");

const app = Router();

app.get("/logs", requirePermission(Permission.AUDIT_VIEW), route({
    summary: "Get audit logs",
    description: "Retrieves audit logs with optional filtering by organization, action, resource, date range, and pagination support.",
    query: getAuditLogsValidation,
}), async (req, res) => {
    try {
        const result = await auditController.getAuditLogs(req.user.id, req.query);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        logger.error("Error in audit logs route", { error: error.message, stack: error.stack });
        res.status(500).json({ message: "An error occurred while retrieving audit logs" });
    }
});

app.get("/metadata", route({
    summary: "Get audit metadata",
    description: "Retrieves metadata information about available audit log types, actions, and resources for filtering purposes.",
}), async (req, res) => {
    try {
        res.json(await auditController.getAuditMetadata());
    } catch (error) {
        logger.error("Error in audit metadata route", { error: error.message });
        res.status(500).json({ message: "An error occurred while retrieving audit metadata" });
    }
});

app.get("/organizations/:id/settings", route({
    summary: "Get organization audit settings",
    description: "Retrieves audit logging configuration settings for a specific organization, including retention policies and enabled audit features.",
}), async (req, res) => {
    try {
        const result = await auditController.getOrganizationAuditSettings(req.user.id, parseInt(req.params.id));
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        logger.error("Error getting organization audit settings", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while retrieving audit settings" });
    }
});

app.patch("/organizations/:id/settings", route({
    summary: "Update organization audit settings",
    description: "Updates audit logging configuration settings for a specific organization, such as retention policies and audit feature toggles.",
    body: updateOrganizationAuditSettingsValidation,
}), async (req, res) => {
    try {
        const result = await auditController.updateOrganizationAuditSettings(req.user.id, parseInt(req.params.id), req.body);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        logger.error("Error updating organization audit settings", { organizationId: req.params.id, error: error.message });
        res.status(500).json({ message: "An error occurred while updating audit settings" });
    }
});

app.get("/:auditLogId/recording", route({
    summary: "Download session recording",
    description: "Downloads a session recording file for the specified audit log entry. Recordings are returned as gzip-compressed files in either Guacamole (.guac) or Asciicast (.cast) format depending on the session type.",
    produces: "application/octet-stream",
}), async (req, res) => {
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
