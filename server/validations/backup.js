const Joi = require("joi");

const optionalText = Joi.string().allow("", null);

const provider = {
    name: Joi.string(),
    type: Joi.string().description("`local`, `smb` or `webdav`"),
    path: optionalText.description("Target directory of a local provider"),
    url: optionalText.description("Server address of a WebDAV provider"),
    folder: optionalText,
    username: optionalText,
    password: optionalText,
    share: optionalText.description("Share name of an SMB provider"),
    domain: optionalText,
};

module.exports.updateBackupSettingsValidation = Joi.object({
    scheduleInterval: Joi.number().integer().min(0).description("Hours between automatic backups, 0 turns them off"),
    retention: Joi.number().integer().min(0).description("Number of backups to keep per provider"),
    includeDatabase: Joi.boolean(),
    includeRecordings: Joi.boolean(),
    includeLogs: Joi.boolean(),
}).unknown(true);

module.exports.createBackupProviderValidation = Joi.object({
    ...provider,
    name: provider.name.required(),
    type: provider.type.required(),
});

module.exports.updateBackupProviderValidation = Joi.object(provider);
