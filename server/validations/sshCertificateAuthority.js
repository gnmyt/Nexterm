const Joi = require("joi");

const principal = Joi.string().trim().min(1).max(128).pattern(/^[^\u0000-\u0008\u000e-\u001f\s,]+$/);
const mapping = Joi.object({
    group: Joi.string().trim().min(1).max(256).required(),
    principals: Joi.array().items(principal).min(1).max(16).required(),
});
const name = Joi.string().trim().min(1).max(255);
const ttlOverride = Joi.object({
    group: Joi.string().trim().min(1).max(256),
    environment: Joi.string().trim().min(1).max(255),
    ttlSeconds: Joi.number().integer().min(30).max(86400).required(),
});

const configSchema = Joi.object({
    address: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
    url: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
    mount: Joi.string().trim().max(128).optional(),
    role: Joi.string().trim().max(128).optional(),
    namespace: Joi.string().trim().max(128).allow("").optional(),
    tokenMode: Joi.string().valid("ott", "bearer", "provisioner").optional(),
    provisioner: Joi.string().trim().max(128).allow("").optional(),
    audience: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
    publicKey: Joi.string().max(8192).optional(),
}).default({});

const fields = {
    name: Joi.string().trim().min(1).max(255),
    backend: Joi.string().valid("local", "vault", "step", "webhook"),
    enabled: Joi.boolean(),
    organizationId: Joi.number().integer().allow(null),
    ttlSeconds: Joi.number().integer().min(30).max(86400),
    sourceAddress: Joi.string().trim().max(512).allow("", null),
    extraPrincipals: Joi.array().items(principal).max(32),
    groupPrincipalMappings: Joi.array().items(mapping).max(64),
    selectorGroups: Joi.array().items(name).max(64),
    domains: Joi.array().items(name).max(64),
    environments: Joi.array().items(name).max(64),
    ttlByGroup: Joi.array().items(ttlOverride).max(64),
    ttlByEnvironment: Joi.array().items(ttlOverride).max(64),
    keyIdTemplate: Joi.string().trim().min(1).max(128),
    config: configSchema,
    secret: Joi.string().max(65536).allow(""),
};

module.exports.createSshCaValidation = Joi.object({
    ...fields,
    name: fields.name.required(),
    backend: fields.backend.required(),
});

module.exports.updateSshCaValidation = Joi.object(fields).min(1);
