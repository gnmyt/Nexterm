const Joi = require("joi");

module.exports.createEngineValidation = Joi.object({
    name: Joi.string().trim().min(1).required(),
});
