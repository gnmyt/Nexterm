const Joi = require("joi");

module.exports.createSessionValidation = Joi.object({
    entryId: Joi.number().required(),
    identityId: Joi.number().allow(null).optional(),
    connectionReason: Joi.string().allow(null, '').optional(),
    type: Joi.string().allow(null).optional(),
    tabId: Joi.string().allow(null).optional(),
    browserId: Joi.string().allow(null).optional(),
    displayDpi: Joi.number().integer().min(96).max(384).optional(),
    displayWidth: Joi.number().integer().min(200).max(8192).optional(),
    displayHeight: Joi.number().integer().min(200).max(8192).optional(),
    scriptId: Joi.number().allow(null).optional(),
    startPath: Joi.string().allow(null).optional(),
    trustPrompt: Joi.boolean().optional(),
    directIdentity: Joi.object({
        username: Joi.string().max(255).optional(),
        type: Joi.string().valid("password", "ssh", "both", "password-only").required(),
        password: Joi.string().optional(),
        sshKey: Joi.string().optional(),
        passphrase: Joi.string().optional(),
    }).optional()
});

module.exports.reconnectSessionValidation = module.exports.createSessionValidation.keys({
    connectionGeneration: Joi.number().integer().min(0).required(),
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

module.exports.trustDecisionValidation = Joi.object({
    fingerprint: Joi.string().max(200).required(),
    accept: Joi.boolean().required(),
});

module.exports.shareValidation = Joi.object({
    writable: Joi.boolean().strict().description("Whether people with the link can also type (default: false)"),
});

module.exports.pastePasswordValidation = Joi.object({
    identityId: Joi.number().integer().allow(null).description("Identity to take the password from (default: the identity of the session)"),
    submit: Joi.boolean().strict().description("Press enter after the password"),
});

module.exports.execCommandQuery = Joi.object({
    identityId: Joi.number().integer().description("Identity to connect with (default: the first identity of the entry)"),
});

module.exports.execCommandValidation = Joi.object({
    command: Joi.string().required(),
    connectionReason: Joi.string().allow(null, ""),
});
