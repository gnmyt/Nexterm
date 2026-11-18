const Joi = require("joi");

module.exports.objectList = Joi.array().items(Joi.object().unknown(true));
module.exports.message = Joi.object({ message: Joi.string().required() });
module.exports.created = module.exports.message.keys({ id: Joi.number().integer().required() });
module.exports.acceptFingerprintValidation = Joi.object({
    acceptFingerprint: Joi.string().max(200).description("Fingerprint of a certificate to trust for this request"),
});
