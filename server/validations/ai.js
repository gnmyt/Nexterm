const Joi = require('joi');
const { providerIds } = require('../lib/ai/providers');

module.exports.updateAISettingsValidation = Joi.object({
    enabled: Joi.boolean(),
    provider: Joi.string().valid(...providerIds()).allow(null),
    model: Joi.string().max(100).allow(null),
    apiKey: Joi.string().allow('', null),
    apiUrl: Joi.string().allow(null),
    authMethod: Joi.string().valid('api_key', 'subscription'),
    requireConfirmation: Joi.boolean()
});

module.exports.generateCommandValidation = Joi.object({
    sessionId: Joi.string().required(),
    prompt: Joi.string().min(1).max(2000).required(),
    shell: Joi.string().max(100).allow('', null),
    rejected: Joi.array().items(Joi.string().max(2000)).max(12)
});

module.exports.oauthExchangeValidation = Joi.object({
    code: Joi.string().required(),
    provider: Joi.string().valid(...providerIds())
});
