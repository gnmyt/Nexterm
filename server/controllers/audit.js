const AuditLog = require("../models/AuditLog");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Account = require("../models/Account");
const { hasOrganizationAccess } = require("../utils/permission");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

const AUDIT_ACTIONS = {
    SSH_CONNECT: "entry.ssh_connect",
    SFTP_CONNECT: "entry.sftp_connect",
    PVE_CONNECT: "entry.pve_connect",
    RDP_CONNECT: "entry.rdp_connect",
    VNC_CONNECT: "entry.vnc_connect",

    FILE_UPLOAD: "file.upload",
    FILE_DOWNLOAD: "file.download",
    FILE_DELETE: "file.delete",
    FILE_RENAME: "file.rename",

    FOLDER_CREATE: "folder.create",
    FOLDER_DELETE: "folder.delete",

    ENTRY_CREATE: "entry.create",
    ENTRY_UPDATE: "entry.update",
    ENTRY_DELETE: "entry.delete",

    IDENTITY_CREATE: "identity.create",
    IDENTITY_UPDATE: "identity.update",
    IDENTITY_DELETE: "identity.delete",

    FOLDER_CREATE_MGMT: "folder_mgmt.create",
    FOLDER_UPDATE_MGMT: "folder_mgmt.update",
    FOLDER_DELETE_MGMT: "folder_mgmt.delete",

    SCRIPT_EXECUTE: "script.execute",

    APP_INSTALL: "app.install",
};

const RESOURCE_TYPES = {
    USER: "user", ENTRY: "entry", IDENTITY: "identity", ORGANIZATION: "organization",
    FOLDER: "folder", FILE: "file", SCRIPT: "script", APP: "app",
};

const getOrgAuditSettings = async (organizationId) => {
    if (!organizationId) return null;

    const org = await Organization.findByPk(organizationId);
    const defaults = {
        requireConnectionReason: false, enableFileOperationAudit: true, enableEntryConnectionAudit: true,
        enableIdentityManagementAudit: true, enableEntryManagementAudit: true, enableFolderManagementAudit: true,
        enableScriptExecutionAudit: true, enableAppInstallationAudit: true,
    };

    if (!org?.auditSettings) return defaults;
    const settings = typeof org.auditSettings === "string" ? JSON.parse(org.auditSettings) : org.auditSettings;
    return { ...defaults, ...settings };
};

const shouldAudit = (action, settings) => {
    if (!settings) return true;
    const checks = [
        [action.startsWith("file."), settings.enableFileOperationAudit],
        [action.startsWith("entry.") && !action.includes("create") && !action.includes("update") && !action.includes("delete"), settings.enableEntryConnectionAudit],
        [action.startsWith("identity."), settings.enableIdentityManagementAudit],
        [action.includes("entry.create") || action.includes("entry.update") || action.includes("entry.delete"), settings.enableEntryManagementAudit],
        [action.startsWith("folder_mgmt."), settings.enableFolderManagementAudit],
        [action.startsWith("script."), settings.enableScriptExecutionAudit],
        [action.startsWith("app."), settings.enableAppInstallationAudit],
    ];

    for (const [condition, enabled] of checks) {
        if (condition) return enabled;
    }
    return true;
};

const createAuditLog = async ({
                                  accountId, organizationId = null, action, resource = null, resourceId = null,
                                  details = {}, ipAddress = null, userAgent = null, reason = null,
                              }) => {
    try {
        if (!accountId || !action || typeof action !== "string") {
            logger.error("Invalid audit log parameters", { accountId, action });
            return;
        }

        if (organizationId) {
            const settings = await getOrgAuditSettings(organizationId);
            if (!shouldAudit(action, settings)) return;
        }

        const auditLog = await AuditLog.create({
            accountId, organizationId, action, resource, resourceId, details,
            ipAddress, userAgent, reason, timestamp: new Date(),
        });

        return auditLog.id;
    } catch (error) {
        logger.error("Failed to create audit log", { error: error.message, stack: error.stack });
    }
};

const getAuditLogsInternal = async (accountId, filters = {}) => {
    const { organizationId, action, resource, startDate, endDate, limit = 100, offset = 0 } = filters;

    const whereClause = {};

    if (organizationId === "personal") {
        whereClause.accountId = accountId;
        whereClause.organizationId = null;
    } else if (organizationId) {
        const membership = await OrganizationMember.findOne({
            where: { organizationId, accountId, status: "active" },
        });
        if (!membership) throw new Error("Access denied to organization audit logs");
        whereClause.organizationId = organizationId;
    } else {
        const memberships = await OrganizationMember.findAll({
            where: { accountId, status: "active" },
        });
        const accessibleOrgIds = memberships.map(m => m.organizationId);
        whereClause[Op.or] = [{ accountId }, { organizationId: { [Op.in]: accessibleOrgIds } }];
    }

    if (action) whereClause.action = action.includes("*") ? { [Op.like]: action.replace("*", "%") } : action;
    if (resource) whereClause.resource = resource;
    if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) whereClause.timestamp[Op.gte] = new Date(startDate).toISOString();
        if (endDate) whereClause.timestamp[Op.lte] = new Date(endDate).toISOString();
    }

    const result = await AuditLog.findAndCountAll({
        where: whereClause, order: [["timestamp", "DESC"]], limit, offset,
    });

    const [accounts, organizations] = await Promise.all([
        Account.findAll({
            where: { id: { [Op.in]: [...new Set(result.rows.map(log => log.accountId))] } },
            attributes: ["id", "firstName", "lastName"],
        }),
        Organization.findAll({
            where: { id: { [Op.in]: [...new Set(result.rows.map(log => log.organizationId).filter(Boolean))] } },
            attributes: ["id", "name"],
        }),
    ]);

    const accountMap = Object.fromEntries(accounts.map(acc => [acc.id, acc]));
    const orgMap = Object.fromEntries(organizations.map(org => [org.id, org]));

    result.rows = result.rows.map(log => ({
        id: log.id, accountId: log.accountId, organizationId: log.organizationId, action: log.action,
        resource: log.resource, resourceId: log.resourceId, ipAddress: log.ipAddress, userAgent: log.userAgent,
        timestamp: log.timestamp,
        details: typeof log.details === "string" ? JSON.parse(log.details) : log.details,
        actorFirstName: accountMap[log.accountId]?.firstName || null,
        actorLastName: accountMap[log.accountId]?.lastName || null,
        organizationName: orgMap[log.organizationId]?.name || null,
    }));

    return result;
};

const updateAuditLogWithSessionDuration = async (auditLogId, connectionStartTime) => {
    try {
        if (!auditLogId || !connectionStartTime) return;

        const auditLog = await AuditLog.findByPk(auditLogId);
        if (!auditLog) return;

        const currentDetails = typeof auditLog.details === "string" ? JSON.parse(auditLog.details) : auditLog.details || {};
        currentDetails.sessionDuration = Math.round((Date.now() - connectionStartTime) / 1000);

        await AuditLog.update({ details: currentDetails }, { where: { id: auditLogId } });
    } catch (error) {
        logger.error("Error updating audit log with session duration", { error: error.message, auditLogId });
    }
};

module.exports.getAuditLogs = async (accountId, filters = {}) => {
    try {
        const { organizationId } = filters;
        if (organizationId && organizationId !== "personal" && !(await hasOrganizationAccess(accountId, organizationId))) {
            return { code: 403, message: "You don't have access to this organization's audit logs" };
        }

        const result = await getAuditLogsInternal(accountId, filters);
        return { logs: result.rows, total: result.count, filters };
    } catch (error) {
        logger.error("Error getting audit logs", { error: error.message, accountId });
        return { code: 500, message: "Failed to retrieve audit logs" };
    }
};

module.exports.getOrganizationAuditSettings = async (accountId, organizationId) => {
    try {
        const membership = await OrganizationMember.findOne({
            where: { organizationId, accountId, status: "active" },
        });
        if (!membership) return { code: 403, message: "You don't have access to this organization" };

        return await getOrgAuditSettings(organizationId);
    } catch (error) {
        logger.error("Error getting organization audit settings", { error: error.message, organizationId });
        return { code: 500, message: "Failed to retrieve audit settings" };
    }
};

module.exports.updateOrganizationAuditSettings = async (accountId, organizationId, settings) => {
    try {
        const membership = await OrganizationMember.findOne({
            where: { organizationId, accountId, status: "active", role: "owner" },
        });
        if (!membership) return { code: 403, message: "You don't have permission to update audit settings" };

        const currentSettings = await getOrgAuditSettings(organizationId);
        const updatedSettings = { ...currentSettings, ...settings };

        await Organization.update({ auditSettings: updatedSettings }, { where: { id: organizationId } });
        return updatedSettings;
    } catch (error) {
        logger.error("Error updating organization audit settings", { error: error.message, organizationId });
        return { code: 500, message: "Failed to update audit settings" };
    }
};

module.exports.getAuditMetadata = async () => ({
    actions: Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({
        key, value, category: value.split(".")[0],
    })),
    resources: Object.entries(RESOURCE_TYPES).map(([key, value]) => ({ key, value })),
    actionCategories: [
        { key: "user", label: "User Management", description: "Login, logout, profile changes" },
        { key: "server", label: "Server Connections", description: "SSH, SFTP, PVE connections" },
        { key: "file", label: "File Operations", description: "Upload, download, delete, rename" },
        { key: "identity", label: "Identity Management", description: "Create, update, delete identities" },
        { key: "organization", label: "Organization Management", description: "Organization and member management" },
        { key: "folder_mgmt", label: "Folder Management", description: "Create, update, delete folders" },
        { key: "script", label: "Script Execution", description: "Script and app execution" },
        { key: "app", label: "App Management", description: "Application installation" },
    ],
});

module.exports.getOrganizationAuditSettingsInternal = async (organizationId) => {
    try {
        const organization = await Organization.findByPk(organizationId);
        return organization?.auditSettings ? JSON.parse(organization.auditSettings) : null;
    } catch (error) {
        logger.error("Error getting organization audit settings internally", { error: error.message, organizationId });
        return null;
    }
};

module.exports.createAuditLog = createAuditLog;
module.exports.isConnectionReasonRequired = async (organizationId) => {
    if (!organizationId) return false;
    const settings = await getOrgAuditSettings(organizationId);
    return settings?.requireConnectionReason || false;
};
module.exports.updateAuditLogWithSessionDuration = updateAuditLogWithSessionDuration;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports.RESOURCE_TYPES = RESOURCE_TYPES;
