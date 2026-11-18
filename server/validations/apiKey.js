const Joi = require("joi");

module.exports.createApiKeyValidation = Joi.object({
    name: Joi.string().trim().min(1).required(),
    expiresAt: Joi.date().allow(null, "").description("When the key stops working. Leave out for a key that never expires"),
});
