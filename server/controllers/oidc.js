const client = require("openid-client");
const OIDCProvider = require("../models/OIDCProvider");
const LDAPProvider = require("../models/LDAPProvider");
const Account = require("../models/Account");
const Session = require("../models/Session");
const { genSalt, hash } = require("bcrypt");
const crypto = require("crypto");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

const stateStore = new Map();

const hasOtherEnabledProvider = async (excludeOidcId = null) => {
    const [oidc, ldap] = await Promise.all([
        OIDCProvider.findOne({ where: excludeOidcId ? { enabled: true, id: { [Op.ne]: excludeOidcId } } : { enabled: true } }),
        LDAPProvider.findOne({ where: { enabled: true } }),
    ]);
    return !!(oidc || ldap);
};

module.exports.listProviders = async (includeSecret = false, forPublic = false) => {
    const providers = await OIDCProvider.findAll();

    if (!includeSecret) {
        let ldapEnabled = false;
        if (forPublic) {
            ldapEnabled = !!(await LDAPProvider.findOne({ where: { enabled: true } }));
        }
        
        return providers.map(provider => ({
            id: provider.id, name: provider.name, issuer: provider.issuer,
            clientId: provider.clientId, redirectUri: provider.redirectUri, scope: provider.scope,
            enabled: (forPublic && provider.isInternal) ? (provider.enabled || ldapEnabled) : provider.enabled,
            usernameAttribute: provider.usernameAttribute,
            firstNameAttribute: provider.firstNameAttribute, lastNameAttribute: provider.lastNameAttribute,
            isInternal: provider.isInternal,
        }));
    }

    return providers;
};

module.exports.getProvider = async (providerId) => {
    return await OIDCProvider.findByPk(providerId);
};

module.exports.createProvider = async (data) => {
    return OIDCProvider.create(data);
};

module.exports.updateProvider = async (providerId, data) => {
    const provider = await OIDCProvider.findByPk(providerId);
    if (!provider) return { code: 404, message: "Provider not found" };

    if (data.enabled === false && provider.enabled) {
        if (!await hasOtherEnabledProvider(providerId)) {
            return { code: 400, message: "At least one authentication provider must remain enabled" };
        }
    }

    if (provider.isInternal) {
        if (Object.keys(data).length !== 1 || !data.hasOwnProperty("enabled")) {
            return { code: 400, message: "Internal authentication provider can only be enabled or disabled" };
        }

        if (data.enabled === true) {
            await LDAPProvider.update({ enabled: false }, { where: {} });
        }
    }

    await OIDCProvider.update(data, { where: { id: providerId } });
    return provider;
};

module.exports.deleteProvider = async (providerId) => {
    const provider = await OIDCProvider.findByPk(providerId);
    if (!provider) {
        return { code: 404, message: "Provider not found" };
    }

    if (provider.isInternal) {
        return { code: 400, message: "Cannot delete internal authentication provider" };
    }

    if (provider.enabled && !await hasOtherEnabledProvider(providerId)) {
        return { code: 400, message: "Cannot delete the only enabled authentication provider" };
    }

    await OIDCProvider.destroy({ where: { id: providerId } });
    return { message: "Provider deleted successfully" };
};

module.exports.initiateOIDCLogin = async (providerId) => {
    try {
        const provider = await OIDCProvider.findByPk(providerId);

        if (!provider || !provider.enabled) {
            return { code: 404, message: "Provider not found or disabled" };
        }

        let issuerUrl = provider.issuer.replace(/\/$/, "");
        
        const configuration = await client.discovery(
            new URL(issuerUrl),
            provider.clientId,
            provider.clientSecret,
        );

        const state = client.randomState();
        const nonce = client.randomNonce();
        
        const codeVerifier = client.randomPKCECodeVerifier();
        const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

        stateStore.set(state, { nonce, providerId, codeVerifier, timestamp: Date.now() });

        for (const [key, value] of stateStore.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                stateStore.delete(key);
            }
        }

        const parameters = { 
            redirect_uri: provider.redirectUri, 
            scope: provider.scope, 
            state, 
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        };
        const redirectTo = client.buildAuthorizationUrl(configuration, parameters);

        return { url: redirectTo.href };
    } catch (error) {
        logger.error("OIDC login initiation failed", { providerId, error: error.message, stack: error.stack });
        return { code: 500, message: "Failed to initiate OIDC login: " + error.message };
    }
};

module.exports.handleOIDCCallback = async (query, userInfo) => {
    try {
        const storedData = stateStore.get(query.state);
        if (!storedData) {
            logger.warn("OIDC callback received with invalid or expired state", { state: query.state });
            return { code: 400, message: "Invalid or expired state" };
        }

        stateStore.delete(query.state);

        const { providerId, nonce, codeVerifier } = storedData;
        const provider = await OIDCProvider.findByPk(providerId);

        if (!provider) {
            return { code: 404, message: "Provider not found" };
        }

        let issuerUrl = provider.issuer.replace(/\/$/, "");
        
        const configuration = await client.discovery(new URL(issuerUrl), provider.clientId, provider.clientSecret);

        const url = new URL(provider.redirectUri + "?" + new URLSearchParams(query).toString());

        const tokens = await client.authorizationCodeGrant(configuration, url, {
            expectedState: query.state,
            expectedNonce: nonce,
            pkceCodeVerifier: codeVerifier,
        });

        let userinfo;
        try {
            userinfo = await client.fetchUserInfo(configuration, tokens.access_token, tokens.claims().sub);
        } catch (userinfoError) {
            logger.warn("Failed to fetch userinfo, falling back to ID token claims", { error: userinfoError.message });
            userinfo = tokens.claims();
        }

        const username = userinfo[provider.usernameAttribute] || userinfo.preferred_username || userinfo.email || userinfo.sub;
        const firstName = userinfo[provider.firstNameAttribute] || userinfo.given_name || "";
        const lastName = userinfo[provider.lastNameAttribute] || userinfo.family_name || "";

        let account = await Account.findOne({ where: { username: String(username) } });

        if (!account) {
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const salt = await genSalt(10);
            const hashedPassword = await hash(randomPassword, salt);

            account = await Account.create({
                username: String(username),
                password: hashedPassword,
                firstName: String(firstName),
                lastName: String(lastName),
                role: "user",
            });
        } else {
            await Account.update({
                firstName: String(firstName),
                lastName: String(lastName),
            }, { where: { id: account.id } });
        }

        const session = await Session.create({
            accountId: account.id,
            ip: userInfo.ip || "OIDC Login",
            userAgent: userInfo.userAgent || "OIDC Client",
        });

        return {
            token: session.token,
            user: {
                id: account.id,
                username: account.username,
                firstName: account.firstName,
                lastName: account.lastName,
                role: account.role,
            },
        };
    } catch (error) {
        logger.error("OIDC callback processing failed", { error: error.message, stack: error.stack });
        return { code: 500, message: "Failed to process OIDC login: " + error.message };
    }
};

module.exports.ensureInternalProvider = async () => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true } });

    if (!internalProvider) {
        await OIDCProvider.create({
            name: "Internal Authentication",
            issuer: "internal",
            clientId: "internal",
            clientSecret: null,
            redirectUri: "internal",
            scope: "internal",
            enabled: true,
            isInternal: true,
            usernameAttribute: "username",
            firstNameAttribute: "firstName",
            lastNameAttribute: "lastName",
        });
    }
};

