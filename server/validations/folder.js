const Joi = require('joi');
const { createIdentityValidation, updateIdentityValidation } = require('./identity');

const temporaryIdentityId = Joi.string().pattern(/^new-[A-Za-z0-9-]+$/);

module.exports.folderCreationValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional(),
    config: Joi.object().unknown(true).optional()
});

module.exports.folderEditValidation = Joi.object({
    name: Joi.string().min(1).max(50),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional(),
    config: Joi.object().unknown(true).optional(),
    identityProfiles: Joi.object().pattern(
        Joi.string().valid("ssh", "telnet", "rdp", "vnc", "sftp", "ftp", "ftps"),
        Joi.array().items(Joi.alternatives().try(Joi.number().integer(), temporaryIdentityId)).unique()
    ).optional(),
    identityCreates: Joi.array().items(Joi.object({
        temporaryId: temporaryIdentityId.required(),
        config: createIdentityValidation.required(),
    })).unique("temporaryId").optional(),
    identityUpdates: Joi.array().items(Joi.object({
        id: Joi.number().integer().required(),
        config: updateIdentityValidation.required(),
    })).unique("id").optional(),
    inheritancePolicy: Joi.string().valid("retain", "adopt").optional(),
    inheritanceTransitions: Joi.array().items(Joi.object({
        protocol: Joi.string().valid("ssh", "telnet", "rdp", "vnc", "sftp", "ftp", "ftps").required(),
        section: Joi.string().valid("details", "settings", "identities").required(),
        from: Joi.string().valid("transparent", "enabled", "disabled").required(),
        to: Joi.string().valid("transparent", "enabled", "disabled").required(),
        policy: Joi.string().valid("retain", "adopt").optional()
    })).unique((left, right) => left.protocol === right.protocol && left.section === right.section).optional()
}).min(1);
