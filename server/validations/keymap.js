const Joi = require('joi');

module.exports.updateKeymapValidation = Joi.object({
    key: Joi.string().min(1).max(50).pattern(/^[\w\u00C0-\u017F]+(\+[\w\u00C0-\u017F]+)*$/i),
    enabled: Joi.boolean(),
}).or('key', 'enabled');
