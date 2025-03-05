const Joi = require('joi');

module.exports.oidcProviderValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    issuer: Joi.string().uri().required(),
    clientId: Joi.string().required(),
    clientSecret: Joi.string().allow('', null),
    redirectUri: Joi.string().uri().required(),
    scope: Joi.string().default('openid profile email'),
    enabled: Joi.boolean().default(false),
    emailAttribute: Joi.string().default('email'),
    firstNameAttribute: Joi.string().default('given_name'),
    lastNameAttribute: Joi.string().default('family_name'),
    usernameAttribute: Joi.string().default('preferred_username')
});

module.exports.oidcProviderUpdateValidation = Joi.object({
    name: Joi.string().min(1).max(50),
    issuer: Joi.string().uri(),
    clientId: Joi.string(),
    clientSecret: Joi.string().allow('', null),
    redirectUri: Joi.string().uri(),
    scope: Joi.string(),
    enabled: Joi.boolean(),
    emailAttribute: Joi.string(),
    firstNameAttribute: Joi.string(),
    lastNameAttribute: Joi.string(),
    usernameAttribute: Joi.string()
});