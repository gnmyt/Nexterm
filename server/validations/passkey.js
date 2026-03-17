const Joi = require('joi');

module.exports.passkeyRenameValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
});

module.exports.passkeyRegistrationValidation = Joi.object({
    response: Joi.object().required(),
    name: Joi.string().min(1).max(50).default("Passkey"),
    origin: Joi.string().uri().required(),
});

module.exports.passkeyAuthenticationValidation = Joi.object({
    response: Joi.object().required(),
    origin: Joi.string().uri().required(),
});

module.exports.passkeyAuthOptionsValidation = Joi.object({
    username: Joi.string().min(3).max(15).alphanum(),
    origin: Joi.string().uri().required(),
});
