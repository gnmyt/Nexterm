const Joi = require("joi");

const themeCreationValidation = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    css: Joi.string().min(1).max(100000).required(),
    description: Joi.string().max(1000).allow("", null),
});

const themeUpdateValidation = Joi.object({
    name: Joi.string().min(1).max(255),
    css: Joi.string().min(1).max(100000),
    description: Joi.string().max(1000).allow("", null),
});

const activeThemeValidation = Joi.object({
    themeId: Joi.number().integer().allow(null).required(),
});

module.exports = { themeCreationValidation, themeUpdateValidation, activeThemeValidation };
