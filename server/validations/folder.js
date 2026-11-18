const Joi = require('joi');
const { createIdentityValidation, updateIdentityValidation } = require('./identity');

const temporaryIdentityId = Joi.string().pattern(/^new-[A-Za-z0-9-]+$/);

const FOLDER_PROFILE_PROTOCOLS = ["ssh", "telnet", "rdp", "vnc", "sftp", "ftp", "ftps"];
const protocol = Joi.string().valid(...FOLDER_PROFILE_PROTOCOLS);

module.exports.FOLDER_PROFILE_PROTOCOLS = FOLDER_PROFILE_PROTOCOLS;

module.exports.folderCreationValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional()
});

module.exports.folderEditValidation = Joi.object({
    name: Joi.string().min(1).max(50),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional(),
    profiles: Joi.object().pattern(protocol, Joi.object().unknown(true)).optional(),
    identityProfiles: Joi.object().pattern(
        protocol,
        Joi.array().items(Joi.alternatives().try(Joi.number().integer(), temporaryIdentityId)).unique()
    ).optional(),
    identityCreates: Joi.array().items(Joi.object({
        temporaryId: temporaryIdentityId.required(),
        config: createIdentityValidation.required(),
    })).unique("temporaryId").optional(),
    identityUpdates: Joi.array().items(Joi.object({
        id: Joi.number().integer().required(),
        config: updateIdentityValidation.required(),
    })).unique("id").optional()
}).min(1);
