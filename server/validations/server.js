const Joi = require("joi");

const configValidation = Joi.object({
    protocol: Joi.string().valid("ssh", "telnet", "rdp", "vnc").optional(),
    ip: Joi.string().optional(),
    port: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    keyboardLayout: Joi.string().optional(),
    monitoringEnabled: Joi.boolean().optional(),
    nodeName: Joi.string().optional(),
    vmid: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    jumpHosts: Joi.array().items(Joi.number()).optional(),
}).unknown(true);

module.exports.createServerValidation = Joi.object({
    name: Joi.string().required(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().valid("server", "pve-shell", "pve-lxc", "pve-qemu").optional().default("server"),
    renderer: Joi.string().optional(),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation.required()
});

module.exports.updateServerValidation = Joi.object({
    name: Joi.string().optional(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional(),
    icon: Joi.string().optional(),
    type: Joi.string().valid("server", "pve-shell", "pve-lxc", "pve-qemu").optional(),
    renderer: Joi.string().optional(),
    identities: Joi.array().items(Joi.number()).optional(),
    config: configValidation
});

module.exports.repositionServerValidation = Joi.object({
    targetId: Joi.number().allow(null).optional(),
    placement: Joi.string().valid('before', 'after').required(),
    folderId: Joi.number().allow(null).optional(),
    organizationId: Joi.number().allow(null).optional()
});