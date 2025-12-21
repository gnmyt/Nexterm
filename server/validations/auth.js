const Joi = require('joi');

module.exports.loginValidation = Joi.object({
    username: Joi.string().min(3).max(15).alphanum().required(),
    password: Joi.string().min(3).max(150).required(),
    code: Joi.number().integer()
});

module.exports.tokenValidation = Joi.object({
    token: Joi.string().hex().length(96).required()
});