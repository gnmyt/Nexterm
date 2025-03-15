const Joi = require("joi");

const configValidation = Joi.object({
    keyboardLayout: Joi.string().optional()
});

module.exports.createServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().required(),
    icon: Joi.string().optional(),
    protocol: Joi.string().valid("ssh", "rdp", "vnc").required(),
    ip: Joi.string().required(),
    port: Joi.number().required(),
    identities: Joi.array().items(Joi.number()).optional(),
    organizationId: Joi.number().optional(),
    config: configValidation
});

module.exports.updateServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().optional(),
    icon: Joi.string().optional(),
    protocol: Joi.string().valid("ssh", "rdp", "vnc").optional(),
    ip: Joi.string().optional(),
    port: Joi.number().optional(),
    position: Joi.number().optional(),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation
});