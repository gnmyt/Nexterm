const Joi = require('joi');

module.exports.loginValidation = Joi.object({
    username: Joi.string().max(255).required(),
    password: Joi.string().max(255).required(),
    code: Joi.number().integer()
});

module.exports.tokenValidation = Joi.object({
    token: Joi.string().hex().length(96).required()
});