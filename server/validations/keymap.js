const Joi = require('joi');

module.exports.updateKeymapValidation = Joi.object({
    key: Joi.string().min(1).max(50).pattern(/^[a-z0-9]+(\+[a-z0-9]+)*$/i),
    enabled: Joi.boolean(),
}).or('key', 'enabled');
