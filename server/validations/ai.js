const Joi = require('joi');
const { providerIds } = require('../lib/ai/providers');

module.exports.updateAISettingsValidation = Joi.object({
    enabled: Joi.boolean(),
    provider: Joi.string().valid(...providerIds()).allow(null),
    model: Joi.string().max(100).allow(null),
    apiKey: Joi.string().allow('', null),
    apiUrl: Joi.string().allow(null),
    anthropicAuthMethod: Joi.string().valid('api_key', 'subscription'),
    requireConfirmation: Joi.boolean()
});

module.exports.oauthExchangeValidation = Joi.object({
    code: Joi.string().required()
});
