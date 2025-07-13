const Joi = require("joi");

module.exports.getAuditLogsValidation = Joi.object({
    organizationId: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string().valid('personal')
    ).optional(),
    action: Joi.string().max(100).optional(),
    resource: Joi.string().max(50).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).optional(),
    limit: Joi.number().integer().min(1).max(1000).default(50),
    offset: Joi.number().integer().min(0).default(0),
});

module.exports.updateOrganizationAuditSettingsValidation = Joi.object({
    requireConnectionReason: Joi.boolean().optional(),
    enableFileOperationAudit: Joi.boolean().optional(),
    enableServerConnectionAudit: Joi.boolean().optional(),
    enableIdentityManagementAudit: Joi.boolean().optional(),
    enableServerManagementAudit: Joi.boolean().optional(),
    enableFolderManagementAudit: Joi.boolean().optional(),
    enableScriptExecutionAudit: Joi.boolean().optional(),
    enableAppInstallationAudit: Joi.boolean().optional(),
}).min(1);