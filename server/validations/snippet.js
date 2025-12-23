const Joi = require("joi");

module.exports.snippetCreationValidation = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    command: Joi.string().min(1).required(),
    description: Joi.string().allow(null, ""),
    organizationId: Joi.number().integer().allow(null),
    osFilter: Joi.array().items(Joi.string()).allow(null),
});

module.exports.snippetEditValidation = Joi.object({
    name: Joi.string().min(1).max(255),
    command: Joi.string().min(1),
    description: Joi.string().allow(null, ""),
    osFilter: Joi.array().items(Joi.string()).allow(null),
});

module.exports.snippetRepositionValidation = Joi.object({
    targetId: Joi.number().integer().required(),
});