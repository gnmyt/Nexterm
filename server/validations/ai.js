const Joi = require('joi');

module.exports.updateAISettingsValidation = Joi.object({
    enabled: Joi.boolean(),
    provider: Joi.string().valid('ollama', 'openai').allow(null),
    model: Joi.string().max(100).allow(null),
    apiKey: Joi.string().allow('', null),
    apiUrl: Joi.string().allow(null)
});

module.exports.generateCommandValidation = Joi.object({
    prompt: Joi.string().required()
});
