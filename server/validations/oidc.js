const Joi = require('joi');

module.exports.oidcProviderValidation = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    issuer: Joi.string().uri().required(),
    clientId: Joi.string().required(),
    clientSecret: Joi.string().allow('', null),
    redirectUri: Joi.string().uri().required(),
    scope: Joi.string().default('openid profile'),
    enabled: Joi.boolean().default(false),
    firstNameAttribute: Joi.string().default('given_name'),
    lastNameAttribute: Joi.string().default('family_name'),
    usernameAttribute: Joi.string().default('preferred_username'),
    isInternal: Joi.boolean().default(false)
});

module.exports.oidcProviderUpdateValidation = Joi.object({
    name: Joi.string().min(1).max(50),
    issuer: Joi.string().uri(),
    clientId: Joi.string(),
    clientSecret: Joi.string().allow('', null),
    redirectUri: Joi.string().uri(),
    scope: Joi.string(),
    enabled: Joi.boolean(),
    firstNameAttribute: Joi.string(),
    lastNameAttribute: Joi.string(),
    usernameAttribute: Joi.string(),
    isInternal: Joi.boolean()
});