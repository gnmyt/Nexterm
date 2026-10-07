const Joi = require('joi');

module.exports.folderCreationValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional()
});

module.exports.folderEditValidation = Joi.object({
    name: Joi.string().min(1).max(50),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional()
}).min(1);

module.exports.folderRepositionValidation = Joi.object({
    targetId: Joi.number().integer().allow(null).optional(),
    placement: Joi.string().valid('before', 'after').optional(),
    parentId: Joi.number().integer().allow(null).optional(),
    organizationId: Joi.number().integer().allow(null).optional()
});