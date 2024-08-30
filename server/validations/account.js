const Joi = require('joi');

module.exports.registerValidation = Joi.object({
    username: Joi.string().min(3).max(15).alphanum().required(),
    password: Joi.string().min(5).max(150).required()
        .pattern(new RegExp('^(?=.*[0-9])(?=.*[^a-zA-Z0-9])')),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
});

module.exports.totpSetup = Joi.object({
    code: Joi.number().integer().required(),
});

module.exports.passwordChangeValidation = Joi.object({
    password: Joi.string().min(5).max(150).required()
        .pattern(new RegExp('^(?=.*[0-9])(?=.*[^a-zA-Z0-9])')),
});

module.exports.updateNameValidation = Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
}).or('firstName', 'lastName');