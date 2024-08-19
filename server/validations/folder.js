const Joi = require('joi');

module.exports.folderCreationValidation = Joi.object({
    name: Joi.string().min(3).max(15).required(),
    parentId: Joi.number().integer()
});

module.exports.folderRenameValidation = Joi.object({
    name: Joi.string().min(3).max(15).required()
});