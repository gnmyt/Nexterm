const Joi = require("joi");

module.exports.createTagValidation = Joi.object({
    name: Joi.string().required(),
    color: Joi.string().required(),
});

module.exports.updateTagValidation = Joi.object({
    name: Joi.string().allow(""),
    color: Joi.string().allow(""),
});
