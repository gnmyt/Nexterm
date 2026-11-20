const Joi = require("joi");
const { createIdentityValidation, updateIdentityValidation } = require("./identity");

const identityId = (item) => typeof item === "number" ? item : item.id;
const identities = Joi.array().items(
    Joi.number().integer(),
    createIdentityValidation.keys({ global: Joi.boolean() }),
    updateIdentityValidation.keys({ id: Joi.number().integer().required(), global: Joi.boolean() }),
).unique((a, b) => identityId(a) !== undefined && identityId(a) === identityId(b)).optional();

const configValidation = Joi.object({
    protocol: Joi.string().valid("ssh", "telnet", "rdp", "vnc", "spice", "sftp", "ftp", "ftps", "demo").optional(),
    ip: Joi.string().optional(),
    port: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    keyboardLayout: Joi.string().optional(),
    monitoringEnabled: Joi.boolean().optional(),
    nodeName: Joi.string().optional(),
    vmid: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    rdpSecurity: Joi.string().valid("any", "nla", "tls", "rdp", "vmconnect").allow("").optional(),
    jumpHosts: Joi.array().items(Joi.number()).optional(),
    macAddress: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).allow("").optional(),
    wakeOnLanEnabled: Joi.boolean().optional(),
    wolBroadcastAddress: Joi.string().ip({ version: ['ipv4'] }).allow("").optional(),
    preLocalCommand: Joi.string().allow("").max(2000).optional(),
    preRemoteCommand: Joi.string().allow("").max(2000).optional(),
    preOrder: Joi.string().valid("local-first", "remote-first").optional(),
    afterLocalCommand: Joi.string().allow("").max(2000).optional(),
    afterRemoteCommand: Joi.string().allow("").max(2000).optional(),
    afterOrder: Joi.string().valid("local-first", "remote-first").optional(),
    notes: Joi.string().allow("", null).optional(),
    showNoteInList: Joi.boolean().allow(null).optional(),
}).unknown(true).custom((value, helpers) => {
    if (value.protocol && value.protocol !== "ssh") {
        for (const key of ["preLocalCommand", "preRemoteCommand", "preOrder", "afterLocalCommand", "afterRemoteCommand", "afterOrder"]) {
            if (value[key] !== undefined && String(value[key]).trim() !== "") {
                return helpers.error("config.hooksNonSsh", { key });
            }
        }
    }
    if (typeof value.preRemoteCommand === "string" && /[\r\n\x00]/.test(value.preRemoteCommand)) {
        return helpers.error("config.hookControlChars");
    }
    if (typeof value.afterRemoteCommand === "string" && /[\r\n\x00]/.test(value.afterRemoteCommand)) {
        return helpers.error("config.hookControlChars");
    }
    return value;
}).messages({
    "config.hooksNonSsh": "Connection hooks are only supported for SSH servers",
    "config.hookControlChars": "Remote hook commands must not contain control characters",
});

module.exports.createServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().valid("server").optional().default("server"),
    renderer: Joi.string().optional(),
    disabled: Joi.boolean().optional(),
    identities,
    config: configValidation.fork(["protocol"], (schema) => schema.required()).required()
});

module.exports.updateServerValidation = Joi.object({
    name: Joi.string().optional(),
    icon: Joi.string().optional(),
    type: Joi.string().valid("server", "pve-shell", "pve-lxc", "pve-qemu").optional(),
    renderer: Joi.string().optional(),
    disabled: Joi.boolean().optional(),
    identities,
    config: configValidation
});

module.exports.repositionServerValidation = Joi.object({
    targetId: Joi.number().allow(null).optional(),
    placement: Joi.string().valid('before', 'after').required(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional()
});

module.exports.configValidation = configValidation;

module.exports.importSSHConfigValidation = Joi.object({
    servers: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        ip: Joi.string().allow("", null),
        port: Joi.number().allow(null),
        config: Joi.object().unknown(true).allow(null),
        identities: Joi.array().items(Joi.number().integer()).allow(null).description("Ids of existing identities"),
    }).unknown(true)).required(),
    folderId: Joi.number().integer().allow(null),
    organizationId: Joi.number().integer().allow(null),
});
