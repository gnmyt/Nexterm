const Joi = require('joi');

const fields = {
    name: Joi.string().min(1).max(50),
    host: Joi.string(),
    port: Joi.number().integer().min(1).max(65535),
    bindDN: Joi.string(),
    bindPassword: Joi.string().allow('', null),
    baseDN: Joi.string(),
    userSearchFilter: Joi.string(),
    usernameAttribute: Joi.string(),
    firstNameAttribute: Joi.string(),
    lastNameAttribute: Joi.string(),
    enabled: Joi.boolean(),
    useTLS: Joi.boolean(),
};

module.exports.ldapProviderValidation = Joi.object({
    ...fields,
    name: fields.name.required(),
    host: fields.host.required(),
    port: fields.port.default(389),
    bindDN: fields.bindDN.required(),
    baseDN: fields.baseDN.required(),
    userSearchFilter: fields.userSearchFilter.default('(uid={{username}})'),
    usernameAttribute: fields.usernameAttribute.default('uid'),
    firstNameAttribute: fields.firstNameAttribute.default('givenName'),
    lastNameAttribute: fields.lastNameAttribute.default('sn'),
    enabled: fields.enabled.default(false),
    useTLS: fields.useTLS.default(false),
});

module.exports.ldapProviderUpdateValidation = Joi.object(fields);
