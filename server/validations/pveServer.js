const Joi = require('joi');

module.exports.createPVEServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().required(),
    organizationId: Joi.number().optional().allow(null),
    ip: Joi.string().required(),
    port: Joi.number().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
});

module.exports.updatePVEServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().optional(),
    organizationId: Joi.number().optional().allow(null),
    ip: Joi.string().optional(),
    port: Joi.number().optional(),
    username: Joi.string().optional(),
    password: Joi.string().optional(),
    nodeName: Joi.string().optional().allow(null),
});