const Joi = require('joi');

module.exports.folderCreationValidation = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional()
});

module.exports.folderEditValidation = Joi.object({
    name: Joi.string().min(3).max(50),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional()
}).min(1);