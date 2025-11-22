const Joi = require("joi");

module.exports.createSessionValidation = Joi.object({
    entryId: Joi.number().required(),
    identityId: Joi.number().allow(null).optional(),
    connectionReason: Joi.string().allow(null, '').optional(),
    type: Joi.string().allow(null).optional()
});

module.exports.sessionIdValidation = Joi.object({
    id: Joi.string().uuid().required()
});
