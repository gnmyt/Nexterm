const Joi = require("joi");

const sourceCreationValidation = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    url: Joi.string().uri().required(),
});

const sourceUpdateValidation = Joi.object({
    name: Joi.string().min(1).max(255),
    url: Joi.string().uri(),
    enabled: Joi.boolean(),
});

const validateUrlValidation = Joi.object({
    url: Joi.string().uri().required(),
});

module.exports = { sourceCreationValidation, sourceUpdateValidation, validateUrlValidation };
