const AuditLog = require("../models/AuditLog");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const Account = require("../models/Account");
const Entry = require("../models/Entry");
const Identity = require("../models/Identity");
const Folder = require("../models/Folder");
const Script = require("../models/Script");
const { hasOrganizationAccess } = require("../utils/permission");
const { Op } = require("sequelize");
const logger = require("../utils/logger");
const { getRecordingInfo } = require("../utils/recordingService");
const { normalizeIp } = require("../utils/ip");

const RESOURCE_CONFIG = {
    entry: { model: Entry, detailsKey: "name" },
    identity: { model: Identity, detailsKey: "identityName" },
    folder: { model: Folder, detailsKey: "folderName" },
    script: { model: Script, detailsKey: "name" },
};

const AUDIT_ACTIONS = {
    ENTRY_CREATE: "entry.create",
    ENTRY_UPDATE: "entry.update",
    ENTRY_DELETE: "entry.delete",
    SSH_CONNECT: "entry.ssh_connect",
    SFTP_CONNECT: "entry.sftp_connect",
    PVE_CONNECT: "entry.pve_connect",
    RDP_CONNECT: "entry.rdp_connect",
    VNC_CONNECT: "entry.vnc_connect",

    FILE_CREATE: "file.create",
    FILE_UPLOAD: "file.upload",
    FILE_DOWNLOAD: "file.download",
    FILE_DELETE: "file.delete",
    FILE_RENAME: "file.rename",
    FILE_CHMOD: "file.chmod",

    FOLDER_CREATE: "folder.create",
    FOLDER_DELETE: "folder.delete",
    FOLDER_DOWNLOAD: "folder.download",

    FOLDER_MGMT_CREATE: "folder_mgmt.create",
    FOLDER_MGMT_UPDATE: "folder_mgmt.update",
    FOLDER_MGMT_DELETE: "folder_mgmt.delete",

    IDENTITY_CREATE: "identity.create",
    IDENTITY_UPDATE: "identity.update",
    IDENTITY_DELETE: "identity.delete",
    IDENTITY_CREDENTIALS_ACCESS: "identity.credentials_access",

    SCRIPT_EXECUTE: "script.execute",
};

const RESOURCE_TYPES = {
    ENTRY: "entry",
    IDENTITY: "identity",
    FOLDER: "folder",
    FILE: "file",
    SCRIPT: "script",
};

const ACTION_LABELS = {
    "entry.create": "Server created",
    "entry.update": "Server updated",
    "entry.delete": "Server deleted",
    "entry.ssh_connect": "SSH connection",
    "entry.sftp_connect": "SFTP connection",
    "entry.pve_connect": "Proxmox connection",
    "entry.rdp_connect": "RDP connection",
    "entry.vnc_connect": "VNC connection",

    "file.create": "File created",
    "file.upload": "File uploaded",
    "file.download": "File downloaded",
    "file.delete": "File deleted",
    "file.rename": "File renamed / moved",
    "file.chmod": "File permissions changed",

    "folder.create": "Folder created (SFTP)",
    "folder.delete": "Folder deleted (SFTP)",
    "folder.download": "Folder downloaded",

    "folder_mgmt.create": "Folder created",
    "folder_mgmt.update": "Folder updated",
    "folder_mgmt.delete": "Folder deleted",

    "identity.create": "Identity created",
    "identity.update": "Identity updated",
    "identity.delete": "Identity deleted",
    "identity.credentials_access": "Identity credentials accessed",

    "script.execute": "Script executed",
};

const ACTION_CATEGORIES = [
    { key: "entry", label: "Servers", description: "Server records and remote connections" },
    { key: "file", label: "Files", description: "File create, upload, download, delete, rename, chmod" },
    { key: "folder", label: "Folders (SFTP)", description: "Folder operations performed over SFTP" },
    { key: "folder_mgmt", label: "Folder Management", description: "Folder records management" },
    { key: "identity", label: "Identities", description: "Identity records and credential access" },
    { key: "script", label: "Scripts", description: "Script execution" },
];

const RESOURCE_LABELS = {
    entry: "Server",
    identity: "Identity",
    folder: "Folder",
    file: "File",
    script: "Script",
};

const getOrgAuditSettings = async (organizationId) => {
    if (!organizationId) return null;

    const org = await Organization.findByPk(organizationId);
    const defaults = {
        requireConnectionReason: false, 
        enableFileOperationAudit: true, 
        enableServerConnectionAudit: true,
        enableIdentityManagementAudit: true, 
        enableIdentityCredentialsAccessAudit: true,
        enableServerManagementAudit: true, 
        enableFolderManagementAudit: true,
        enableScriptExecutionAudit: true,
    };

    if (!org?.auditSettings) return defaults;
    
    return { ...defaults, ...org.auditSettings };
};

const shouldAudit = (action, settings) => {
    if (!settings) return true;
    if (action === AUDIT_ACTIONS.IDENTITY_CREDENTIALS_ACCESS) return settings.enableIdentityCredentialsAccessAudit;

    const checks = [
        [action.startsWith("file.") || action.startsWith("folder."), settings.enableFileOperationAudit],
        [action.startsWith("entry.") && !action.includes("create") && !action.includes("update") && !action.includes("delete"), settings.enableServerConnectionAudit],
        [action.startsWith("identity."), settings.enableIdentityManagementAudit],
        [action.includes("entry.create") || action.includes("entry.update") || action.includes("entry.delete"), settings.enableServerManagementAudit],
        [action.startsWith("folder_mgmt."), settings.enableFolderManagementAudit],
        [action.startsWith("script."), settings.enableScriptExecutionAudit],
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
            ipAddress: normalizeIp(ipAddress), userAgent, reason, timestamp: new Date(),
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

    const accountIds = new Set(), orgIds = new Set(), resourceIdsByType = {};
    for (const log of result.rows) {
        accountIds.add(log.accountId);
        if (log.organizationId) orgIds.add(log.organizationId);
        if (log.resource && log.resourceId && RESOURCE_CONFIG[log.resource]) {
            (resourceIdsByType[log.resource] ??= new Set()).add(log.resourceId);
        }
    }

    const resourceQueries = Object.entries(resourceIdsByType).map(([type, ids]) =>
        RESOURCE_CONFIG[type].model.findAll({ where: { id: { [Op.in]: [...ids] } }, attributes: ["id", "name"] })
            .then(rows => [type, new Map(rows.map(r => [r.id, r.name]))])
    );
    const [accounts, orgs, ...resources] = await Promise.all([
        Account.findAll({ where: { id: { [Op.in]: [...accountIds] } }, attributes: ["id", "firstName", "lastName"] }),
        orgIds.size ? Organization.findAll({ where: { id: { [Op.in]: [...orgIds] } }, attributes: ["id", "name"] }) : [],
        ...resourceQueries,
    ]);

    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const orgMap = new Map(orgs.map(o => [o.id, o.name]));
    const resourceMaps = Object.fromEntries(resources);

    result.rows = result.rows.map(log => {
        const cfg = RESOURCE_CONFIG[log.resource];
        const resourceName = resourceMaps[log.resource]?.get(log.resourceId) || log.details?.[cfg?.detailsKey] || null;
        const actor = accountMap.get(log.accountId);
        return {
            id: log.id,
            accountId: log.accountId,
            organizationId: log.organizationId,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            resourceName,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            timestamp: log.timestamp,
            details: log.details,
            reason: log.reason,
            actorFirstName: actor?.firstName || null,
            actorLastName: actor?.lastName || null,
            organizationName: orgMap.get(log.organizationId) || null,
        };
    });

    return result;
};

const updateAuditLogWithSessionDuration = async (auditLogId, connectionStartTime) => {
    try {
        if (!auditLogId || !connectionStartTime) return;

        const auditLog = await AuditLog.findByPk(auditLogId);
        if (!auditLog) return;

        const currentDetails = auditLog.details || {};
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

module.exports.getAuditMetadata = async () => {
    const actions = Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({
        key,
        value,
        category: value.split(".")[0],
        label: ACTION_LABELS[value] || value,
    }));
    const presentCategoryKeys = new Set(actions.map(a => a.category));
    return {
        actions,
        resources: Object.entries(RESOURCE_TYPES).map(([key, value]) => ({
            key, value, label: RESOURCE_LABELS[value] || key,
        })),
        actionCategories: ACTION_CATEGORIES.filter(c => presentCategoryKeys.has(c.key)),
    };
};

module.exports.getOrganizationAuditSettingsInternal = async (organizationId) => {
    try {
        const organization = await Organization.findByPk(organizationId);
        return organization?.auditSettings || null;
    } catch (error) {
        logger.error("Error getting organization audit settings internally", { error: error.message, organizationId });
        return null;
    }
};

module.exports.getRecording = async (accountId, auditLogId) => {
    try {
        const auditLog = await AuditLog.findByPk(auditLogId);
        if (!auditLog) return { code: 404, message: "Audit log not found" };

        if (auditLog.organizationId) {
            if (!(await hasOrganizationAccess(accountId, auditLog.organizationId))) 
                return { code: 403, message: "You don't have access to this recording" };
        } else if (auditLog.accountId !== accountId) {
            return { code: 403, message: "You don't have access to this recording" };
        }

        const recordingInfo = getRecordingInfo(auditLogId);
        if (!recordingInfo.exists) return { code: 404, message: "Recording not found" };

        return { type: recordingInfo.type, path: recordingInfo.path };
    } catch (error) {
        logger.error("Error getting recording", { error: error.message, auditLogId });
        return { code: 500, message: "Failed to retrieve recording" };
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
