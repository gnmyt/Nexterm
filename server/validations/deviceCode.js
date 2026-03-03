const Joi = require("joi");

const codeSchema = Joi.string().pattern(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/).required()
    .messages({ "string.pattern.base": "Code must be in format XXXX-XXXX" });

module.exports.createDeviceCodeValidation = Joi.object({
    clientType: Joi.string().valid("mobile", "connector").required(),
});

module.exports.authorizeDeviceCodeValidation = Joi.object({
    code: codeSchema,
});

module.exports.pollDeviceCodeValidation = Joi.object({
    token: Joi.string().hex().length(64).required(),
});

module.exports.getDeviceCodeInfoValidation = Joi.object({
    code: codeSchema,
});
