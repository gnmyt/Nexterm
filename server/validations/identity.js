const Joi = require("joi");
module.exports.createIdentityValidation = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    username: Joi.string().max(255).optional(),
    type: Joi.string().valid("password", "ssh", "both", "password-only").required(),
    password: Joi.string().optional(),
    sshKey: Joi.string().optional(),
    passphrase: Joi.string().allow("").optional(),
    organizationId: Joi.number().integer().optional(),
});

module.exports.updateIdentityValidation = Joi.object({
    name: Joi.string().min(3).max(255).optional(),
    username: Joi.string().max(255).optional(),
    type: Joi.string().valid("password", "ssh", "both", "password-only").optional(),
    password: Joi.string().optional(),
    sshKey: Joi.string().optional(),
    passphrase: Joi.string().allow("").optional(),
    organizationId: Joi.number().integer().optional(),
}).or("name", "username", "type", "password", "sshKey", "passphrase", "organizationId");

module.exports.moveIdentityValidation = Joi.object({
    organizationId: Joi.number().integer().required(),
});