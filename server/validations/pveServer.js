const Joi = require('joi');

module.exports.createPVEServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().required(),
    ip: Joi.string().required(),
    port: Joi.number().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
});

module.exports.updatePVEServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().optional(),
    ip: Joi.string().optional(),
    port: Joi.number().optional(),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
});