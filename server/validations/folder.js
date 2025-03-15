const Joi = require('joi');

module.exports.folderCreationValidation = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    parentId: Joi.number().integer(),
    organizationId: Joi.number().integer()
});

module.exports.folderEditValidation = Joi.object({
    name: Joi.string().min(3).max(50),
    parentId: Joi.number().integer()
}).min(1);