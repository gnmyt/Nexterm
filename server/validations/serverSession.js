const Joi = require("joi");

module.exports.createSessionValidation = Joi.object({
    entryId: Joi.number().required(),
    identityId: Joi.number().allow(null).optional(),
    connectionReason: Joi.string().allow(null, '').optional(),
    type: Joi.string().allow(null).optional(),
    tabId: Joi.string().allow(null).optional(),
    browserId: Joi.string().allow(null).optional(),
    scriptId: Joi.number().allow(null).optional(),
    startPath: Joi.string().allow(null).optional(),
    directIdentity: Joi.object({
        username: Joi.string().max(255).optional(),
        type: Joi.string().valid("password", "ssh", "both", "password-only").required(),
        password: Joi.string().optional(),
        sshKey: Joi.string().optional(),
        passphrase: Joi.string().optional(),
    }).optional()
});

module.exports.sessionIdValidation = Joi.object({
    id: Joi.string().uuid().required()
});

module.exports.resumeSessionValidation = Joi.object({
    tabId: Joi.string().allow(null).optional(),
    browserId: Joi.string().allow(null).optional()
});

module.exports.duplicateSessionValidation = Joi.object({
    tabId: Joi.string().allow(null).optional(),
    browserId: Joi.string().allow(null).optional()
});

module.exports.reconnectSessionValidation = Joi.object({
    tabId: Joi.string().allow(null).optional(),
    browserId: Joi.string().allow(null).optional()
});
