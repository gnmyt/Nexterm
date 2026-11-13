const { Op } = require("sequelize");
const SshCertificateAuthority = require("../models/SshCertificateAuthority");
const OrganizationMember = require("../models/OrganizationMember");
const { hasAccountPermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { publicKeyFromPrivate } = require("../lib/ssh/openssh");
const { loadProvisionerKey } = require("../lib/ssh/stepToken");
const { normalizeSourceAddress, asArray } = require("../lib/ssh/principals");
const logger = require("../utils/logger");

const canManage = (accountId) => hasAccountPermission(accountId, Permission.SETTINGS_AUTH_PROVIDERS);

const record = (authority) => (authority?.get ? authority.get({ plain: true }) : authority);

const sanitize = (authority) => {
    const value = record(authority);
    const config = value.config ? { ...value.config } : {};
    return {
        id: value.id,
        name: value.name,
        backend: value.backend,
        enabled: value.enabled !== false,
        organizationId: value.organizationId || null,
        ttlSeconds: value.ttlSeconds,
        sourceAddress: value.sourceAddress || "",
        extraPrincipals: asArray(value.extraPrincipals),
        groupPrincipalMappings: asArray(value.groupPrincipalMappings),
        selectorGroups: asArray(value.selectorGroups),
        domains: asArray(value.domains),
        environments: asArray(value.environments),
        ttlByGroup: asArray(value.ttlByGroup),
        ttlByEnvironment: asArray(value.ttlByEnvironment),
        keyIdTemplate: value.keyIdTemplate || "{{username}}",
        config,
        hasSecret: Boolean(value.secret || value.secretEncrypted),
    };
};

const validateLocal = (secret, creating) => {
    if (creating && !secret) return "A CA private key is required";
    if (!secret) return null;
    try {
        publicKeyFromPrivate(secret);
        return null;
    } catch (error) {
        return error.message;
    }
};

const validateVault = (config) => {
    if (!config.address || !config.mount || !config.role) return "Vault address, mount, and role are required";
    return null;
};

const validateStep = (config, secret) => {
    if (!config.url) return "A step-ca URL is required";
    if (config.tokenMode !== "provisioner") return null;
    if (!config.provisioner) return "A step-ca provisioner name is required";
    if (!secret) return null;
    try {
        loadProvisionerKey(secret);
        return null;
    } catch (error) {
        return error.message;
    }
};

const validateWebhook = (config) => (config.url ? null : "A webhook URL is required");

const backendValidators = {
    local: (config, secret, creating) => validateLocal(secret, creating),
    vault: (config) => validateVault(config),
    step: (config, secret) => validateStep(config, secret),
    webhook: (config) => validateWebhook(config),
};

const validateBackend = (backend, config, secret, creating) => {
    const settings = config || {};
    const validator = backendValidators[backend];
    if (!validator) return "SSH certificate authority backend is not supported";
    const message = validator(settings, secret, creating);
    if (message) return message;
    if (creating && backend !== "local" && backend !== "webhook" && !secret) return "A signing token is required";
    return null;
};

const applyConfig = (backend, config, secret, existingConfig = {}) => {
    const next = { ...existingConfig };
    if (config) Object.assign(next, config);
    delete next.publicKey;
    if (backend === "local") {
        if (secret) next.publicKey = publicKeyFromPrivate(secret);
        else if (existingConfig.publicKey) next.publicKey = existingConfig.publicKey;
    }
    return next;
};

const listCertificateAuthorities = async (accountId) => {
    const manage = await canManage(accountId);
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" }, attributes: ["organizationId"] });
    const organizationIds = memberships.map((membership) => membership.organizationId);
    const where = manage ? {} : {
        enabled: true,
        [Op.or]: [
            { organizationId: null },
            ...(organizationIds.length ? [{ organizationId: { [Op.in]: organizationIds } }] : []),
        ],
    };
    const authorities = await SshCertificateAuthority.findAll({ where, order: [["name", "ASC"]], raw: false });
    return authorities.map(sanitize);
};

const createCertificateAuthority = async (accountId, body) => {
    if (!(await canManage(accountId))) return { code: 403, message: "You don't have permission to manage SSH certificate authorities" };
    let sourceAddress = null;
    try {
        sourceAddress = normalizeSourceAddress(body.sourceAddress);
    } catch (error) {
        return { code: 400, message: error.message };
    }
    const checked = validateBackend(body.backend, body.config, body.secret, true);
    if (checked) return { code: 400, message: checked };

    const authority = await SshCertificateAuthority.create({
        name: body.name,
        backend: body.backend,
        enabled: body.enabled !== false,
        organizationId: body.organizationId || null,
        ttlSeconds: body.ttlSeconds || 300,
        sourceAddress,
        extraPrincipals: body.extraPrincipals || [],
        groupPrincipalMappings: body.groupPrincipalMappings || [],
        selectorGroups: body.selectorGroups || [],
        domains: body.domains || [],
        environments: body.environments || [],
        ttlByGroup: body.ttlByGroup || [],
        ttlByEnvironment: body.ttlByEnvironment || [],
        keyIdTemplate: body.keyIdTemplate || "{{username}}",
        config: applyConfig(body.backend, body.config, body.secret),
        secret: body.secret || null,
    });
    logger.info("SSH certificate authority created", { id: authority.id, backend: authority.backend });
    return sanitize(await SshCertificateAuthority.findByPk(authority.id, { raw: false }));
};

const updateCertificateAuthority = async (accountId, id, body) => {
    if (!(await canManage(accountId))) return { code: 403, message: "You don't have permission to manage SSH certificate authorities" };
    const authority = await SshCertificateAuthority.findByPk(id, { raw: false });
    if (!authority) return { code: 404, message: "SSH certificate authority was not found" };

    const backend = body.backend || authority.backend;
    const secret = body.secret === "" ? null : body.secret;
    const checked = validateBackend(backend, body.config || authority.config, secret, false);
    if (checked) return { code: 400, message: checked };
    if (body.sourceAddress !== undefined) {
        try {
            authority.sourceAddress = normalizeSourceAddress(body.sourceAddress);
        } catch (error) {
            return { code: 400, message: error.message };
        }
    }

    const fields = ["name", "enabled", "ttlSeconds", "extraPrincipals", "groupPrincipalMappings", "selectorGroups", "domains", "environments", "ttlByGroup", "ttlByEnvironment", "keyIdTemplate"];
    for (const field of fields) {
        if (body[field] !== undefined) authority[field] = body[field];
    }
    authority.backend = backend;
    if (body.organizationId !== undefined) authority.organizationId = body.organizationId || null;
    if (body.config !== undefined || secret) authority.config = applyConfig(backend, body.config, secret, authority.config || {});
    if (secret) authority.secret = secret;
    await authority.save();
    logger.info("SSH certificate authority updated", { id: authority.id, backend: authority.backend });
    return sanitize(await SshCertificateAuthority.findByPk(authority.id, { raw: false }));
};

const deleteCertificateAuthority = async (accountId, id) => {
    if (!(await canManage(accountId))) return { code: 403, message: "You don't have permission to manage SSH certificate authorities" };
    const authority = await SshCertificateAuthority.findByPk(id, { raw: false });
    if (!authority) return { code: 404, message: "SSH certificate authority was not found" };
    await authority.destroy();
    logger.info("SSH certificate authority deleted", { id, name: authority.name });
    return { success: true };
};

module.exports = {
    listCertificateAuthorities,
    createCertificateAuthority,
    updateCertificateAuthority,
    deleteCertificateAuthority,
};
