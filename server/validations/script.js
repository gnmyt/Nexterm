const Joi = require("joi");

module.exports.scriptValidation = Joi.object({
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().required().min(1).max(500),
    content: Joi.string().required().min(1)
});