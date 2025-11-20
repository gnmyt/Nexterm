const Joi = require("joi");

const configValidation = Joi.object({
    protocol: Joi.string().valid("ssh", "rdp", "vnc").optional(),
    ip: Joi.string().optional(),
    port: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    keyboardLayout: Joi.string().optional(),
    monitoringEnabled: Joi.boolean().optional()
});

module.exports.createServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().optional().default("server"),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation.required()
});

module.exports.updateServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().optional(),
    position: Joi.number().optional(),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation
});