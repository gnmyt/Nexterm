const { Client } = require("ldapts");
const LDAPProvider = require("../models/LDAPProvider");
const OIDCProvider = require("../models/OIDCProvider");
const Session = require("../models/Session");
const logger = require("../utils/logger");
const hostTrust = require("../utils/hostTrust");
const { LINK_CONFLICT, findExternalAccount, verifyTotp, applyExternalAccount } = require("../utils/externalAccount");

const createLdapClient = async (provider) => {
    const url = `${provider.useTLS ? "ldaps" : "ldap"}://${provider.host}:${provider.port}`;
    if (!provider.useTLS) return new Client({ url });

    const socket = await hostTrust.openTrustedTlsSocket(hostTrust.SYSTEM_SCOPE, provider.host, provider.port);
    return new Client({ url, createSecureConnection: () => socket });
};

const hasOtherEnabledProvider = async (excludeLdapId = null) => {
    const [oidc, ldap] = await Promise.all([
        OIDCProvider.findOne({ where: { enabled: true } }),
        LDAPProvider.findOne({ where: excludeLdapId ? { enabled: true, id: { [require("sequelize").Op.ne]: excludeLdapId } } : { enabled: true } }),
    ]);
    return !!(oidc || ldap);
};

const mapProvider = (p) => ({
    id: p.id, name: p.name, host: p.host, port: p.port, bindDN: p.bindDN, baseDN: p.baseDN,
    userSearchFilter: p.userSearchFilter, usernameAttribute: p.usernameAttribute,
    firstNameAttribute: p.firstNameAttribute, lastNameAttribute: p.lastNameAttribute,
    enabled: Boolean(p.enabled), useTLS: Boolean(p.useTLS),
});

module.exports.listProviders = async (includeSecret = false) => {
    const providers = await LDAPProvider.findAll();
    return includeSecret ? providers : providers.map(mapProvider);
};

module.exports.getProvider = async (id) => LDAPProvider.findByPk(id);

module.exports.createProvider = async (data) => LDAPProvider.create(data);

module.exports.updateProvider = async (id, data) => {
    const provider = await LDAPProvider.findByPk(id);
    if (!provider) return { code: 404, message: "Provider not found" };

    if (data.enabled === false && provider.enabled) {
        if (!await hasOtherEnabledProvider(id)) {
            return { code: 400, message: "At least one authentication provider must remain enabled" };
        }
    }

    if (data.enabled === true) {
        await Promise.all([
            OIDCProvider.update({ enabled: false }, { where: { isInternal: true } }),
            LDAPProvider.update({ enabled: false }, { where: {} }),
        ]);
    }

    await LDAPProvider.update(data, { where: { id } });
    return provider;
};

module.exports.deleteProvider = async (id) => {
    const provider = await LDAPProvider.findByPk(id);
    if (!provider) return { code: 404, message: "Provider not found" };

    if (provider.enabled && !await hasOtherEnabledProvider(id)) {
        return { code: 400, message: "Cannot delete the only enabled authentication provider" };
    }

    await LDAPProvider.destroy({ where: { id } });
    return { message: "Provider deleted successfully" };
};

module.exports.testConnection = async (id, accountId = null, acceptFingerprint = null) => {
    const provider = await LDAPProvider.findByPk(id);
    if (!provider) return { code: 404, message: "Provider not found" };

    try {
        await hostTrust.runTrusted(hostTrust.SYSTEM_SCOPE, accountId, acceptFingerprint, async () => {
            const client = await createLdapClient(provider);
            await client.bind(provider.bindDN, provider.bindPassword || "");
            await client.unbind();
        });
        return { success: true, message: "Connection test successful" };
    } catch (error) {
        const trustFailure = await hostTrust.trustFailureResponse(hostTrust.SYSTEM_SCOPE, error, accountId);
        if (trustFailure) return trustFailure;
        logger.error("LDAP connection test failed", { providerId: id, error: error.message });
        return { code: 400, message: `Connection failed: ${error.message}` };
    }
};

const escapeFilterValue = (value) => String(value).replace(/[\\*()\0]/g,
    (character) => `\\${character.charCodeAt(0).toString(16).padStart(2, "0")}`);

const firstValue = (value) => Array.isArray(value) ? value[0] : value;

const externalIdOf = (entry) => {
    const guid = firstValue(entry.objectGUID);
    if (Buffer.isBuffer(guid) && guid.length) return `guid:${guid.toString("hex")}`;
    const uuid = firstValue(entry.entryUUID);
    if (uuid) return `uuid:${uuid}`;
    return `dn:${entry.dn.toLowerCase()}`;
};

module.exports.authenticateUser = async (username, password, userInfo, totpCode = null) => {
    const provider = await LDAPProvider.findOne({ where: { enabled: true } });
    if (!provider) return null;

    let client = null;
    try {
        client = await createLdapClient(provider);
        await client.bind(provider.bindDN, provider.bindPassword || "");

        const { searchEntries } = await client.search(provider.baseDN, {
            scope: "sub",
            filter: provider.userSearchFilter.replace(/\{\{username\}\}/g, escapeFilterValue(username)),
            attributes: [provider.usernameAttribute, provider.firstNameAttribute, provider.lastNameAttribute, "entryUUID", "objectGUID"],
            explicitBufferAttributes: ["objectGUID"],
        });

        if (searchEntries.length !== 1) { await client.unbind(); return null; }

        const userEntry = searchEntries[0];
        const userClient = await createLdapClient(provider);
        try {
            await userClient.bind(userEntry.dn, password);
            await userClient.unbind();
        } catch { await client.unbind(); return null; }

        await client.unbind();

        const identity = {
            provider: "ldap",
            externalId: externalIdOf(userEntry),
            username: String(firstValue(userEntry[provider.usernameAttribute]) || username),
            firstName: String(firstValue(userEntry[provider.firstNameAttribute]) || ""),
            lastName: String(firstValue(userEntry[provider.lastNameAttribute]) || ""),
        };

        const plan = await findExternalAccount(identity);
        if (plan.action === "conflict") {
            logger.warn("LDAP login refused: username belongs to an unlinked account", { username: identity.username });
            return LINK_CONFLICT;
        }

        const totpError = verifyTotp(plan.account, totpCode);
        if (totpError) return totpError;

        const account = await applyExternalAccount(plan, identity);

        const session = await Session.create({ accountId: account.id, ip: userInfo.ip || "LDAP", userAgent: userInfo.userAgent || "LDAP" });
        logger.system(`User ${account.username} logged in via LDAP`, { accountId: account.id, ip: userInfo.ip, linked: plan.action === "link" });

        return { token: session.token, user: { id: account.id, username: account.username, firstName: account.firstName, lastName: account.lastName } };
    } catch (error) {
        logger.error("LDAP authentication failed", { error: error.message });
        try { await client?.unbind(); } catch {}
        return null;
    }
};

module.exports.getEnabledProvider = async () => LDAPProvider.findOne({ where: { enabled: true } });
