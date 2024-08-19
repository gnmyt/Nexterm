const Joi = require('joi');

module.exports.createServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().required(),
    icon: Joi.string().optional(),
    protocol: Joi.string().valid('ssh', 'rdp', 'vnc').required(),
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).required(),
    port: Joi.number().required(),
    identities: Joi.array().items(Joi.string()).optional(),
});

module.exports.updateServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().optional(),
    icon: Joi.string().optional(),
    protocol: Joi.string().valid('ssh', 'rdp', 'vnc').optional(),
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional(),
    port: Joi.number().optional(),
    identities: Joi.array().items(Joi.string()).optional(),
});