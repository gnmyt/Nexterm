const Joi = require("joi");

module.exports.scriptCreationValidation = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    description: Joi.string().allow(null, ""),
    organizationId: Joi.number().integer().allow(null),
    osFilter: Joi.array().items(Joi.string()).allow(null),
});

module.exports.scriptEditValidation = Joi.object({
    name: Joi.string().min(1).max(255),
    content: Joi.string().min(1),
    description: Joi.string().allow(null, ""),
    osFilter: Joi.array().items(Joi.string()).allow(null),
});

module.exports.scriptRepositionValidation = Joi.object({
    targetId: Joi.number().integer().required(),
});