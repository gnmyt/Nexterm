const Joi = require('joi');

module.exports.appObject = Joi.object({
    name: Joi.string().required(),
    version: Joi.string().required(),
    description: Joi.string().required(),
    icon: Joi.string().uri().required(),
    preInstallCommand: Joi.string(),
    postInstallCommand: Joi.string(),
    category: Joi.string().required(),
    port: Joi.number().required()
});

module.exports.createAppSourceValidation = Joi.object({
    name: Joi.string().alphanum().required(),
    url: Joi.string().uri().regex(/\.zip$/).required()
});

module.exports.updateAppUrlValidation = Joi.object({
    url: Joi.string().uri().regex(/\.zip$/).required()
});