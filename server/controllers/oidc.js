const client = require("openid-client");
const OIDCProvider = require("../models/OIDCProvider");
const LDAPProvider = require("../models/LDAPProvider");
const Account = require("../models/Account");
const Session = require("../models/Session");
const Organization = require("../models/Organization");
const { genSalt, hash } = require("bcrypt");
const crypto = require("crypto");
const { Op } = require("sequelize");
const logger = require("../utils/logger");
const { decrypt } = require("../utils/encryption");
const { createOIDCSessionContext } = require("../utils/oidcSession");
const { buildOIDCLogoutUrl, normalizeProviderData } = require("../utils/oidcLogout");
const {
    extractGroupClaim,
    mergeOIDCClaims,
    syncOrganizationMemberships,
} = require("../utils/oidcGroupSync");

const stateStore = new Map();

const hasOtherEnabledProvider = async (excludeOidcId = null) => {
    const [oidc, ldap] = await Promise.all([
        OIDCProvider.findOne({ where: excludeOidcId ? { enabled: true, id: { [Op.ne]: excludeOidcId } } : { enabled: true } }),
        LDAPProvider.findOne({ where: { enabled: true } }),
    ]);
    return !!(oidc || ldap);
};

const fetchOIDCClaims = async (configuration, tokens) => {
    const idTokenClaims = tokens.claims();
    try {
        const userinfo = await client.fetchUserInfo(configuration, tokens.access_token, idTokenClaims.sub);
        return mergeOIDCClaims(idTokenClaims, userinfo);
    } catch (error) {
        logger.warn("Failed to fetch userinfo, falling back to ID token claims", { error: error.message });
        return idTokenClaims;
    }
};

const upsertOIDCAccount = async (username, firstName, lastName) => {
    let account = await Account.findOne({ where: { username } });

    if (!account) {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const salt = await genSalt(10);
        const hashedPassword = await hash(randomPassword, salt);

        return Account.create({ username, password: hashedPassword, firstName, lastName });
    }

    await Account.update({ firstName, lastName }, { where: { id: account.id } });
    return account;
};

module.exports.listOrganizationsForMapping = async () => {
    const organizations = await Organization.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] });
    return organizations.map((organization) => ({ id: organization.id, name: organization.name }));
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
            ...(forPublic ? {} : {
                endSessionEndpoint: provider.endSessionEndpoint,
                groupsAttribute: provider.groupsAttribute,
                requiredGroup: provider.requiredGroup,
                groupMappings: provider.groupMappings,
            }),
            enabled: Boolean((forPublic && provider.isInternal) ? (provider.enabled || ldapEnabled) : provider.enabled),
            usernameAttribute: provider.usernameAttribute,
            firstNameAttribute: provider.firstNameAttribute, lastNameAttribute: provider.lastNameAttribute,
            isInternal: Boolean(provider.isInternal),
            allowRegistration: provider.isInternal
                ? Boolean(forPublic ? (provider.enabled && provider.allowRegistration) : provider.allowRegistration)
                : undefined,
        }));
    }

    return providers;
};

module.exports.getProvider = async (providerId) => {
    return await OIDCProvider.findByPk(providerId);
};

module.exports.createProvider = async (data) => {
    return OIDCProvider.create(normalizeProviderData(data));
};

module.exports.updateProvider = async (providerId, data) => {
    data = normalizeProviderData(data);
    const provider = await OIDCProvider.findByPk(providerId);
    if (!provider) return { code: 404, message: "Provider not found" };

    if (data.enabled === false && provider.enabled) {
        if (!await hasOtherEnabledProvider(providerId)) {
            return { code: 400, message: "At least one authentication provider must remain enabled" };
        }
    }

    if (provider.isInternal) {
        const allowedKeys = ["enabled", "allowRegistration"];
        if (Object.keys(data).length === 0 || Object.keys(data).some(key => !allowedKeys.includes(key))) {
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

        const configuration = await client.discovery(
            new URL(provider.issuer),
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

        const configuration = await client.discovery(new URL(provider.issuer), provider.clientId, provider.clientSecret);

        const url = new URL(provider.redirectUri + "?" + new URLSearchParams(query).toString());

        const tokens = await client.authorizationCodeGrant(configuration, url, {
            expectedState: query.state,
            expectedNonce: nonce,
            pkceCodeVerifier: codeVerifier,
        });

        const claims = await fetchOIDCClaims(configuration, tokens);

        const username = claims[provider.usernameAttribute] || claims.preferred_username || claims.email || claims.sub;
        const firstName = claims[provider.firstNameAttribute] || claims.given_name || "";
        const lastName = claims[provider.lastNameAttribute] || claims.family_name || "";

        const groups = extractGroupClaim(claims, provider.groupsAttribute);

        if (provider.requiredGroup && !groups.includes(provider.requiredGroup)) {
            logger.warn("OIDC login denied: account is missing the required group claim", {
                username: String(username), provider: provider.id,
            });
            return { code: 403, message: "Your account is not authorized to access this application" };
        }

        const account = await upsertOIDCAccount(String(username), String(firstName), String(lastName));

        if (provider.groupsAttribute) {
            await syncOrganizationMemberships(account.id, groups, provider);
        }

        const oidcSessionContext = createOIDCSessionContext(provider.id, tokens.id_token);
        const session = await Session.create({
            accountId: account.id,
            ip: userInfo.ip || "OIDC Login",
            userAgent: userInfo.userAgent || "OIDC Client",
            ...oidcSessionContext,
        });

        return {
            token: session.token,
            user: {
                id: account.id,
                username: account.username,
                firstName: account.firstName,
                lastName: account.lastName,
            },
        };
    } catch (error) {
        logger.error("OIDC callback processing failed", { error: error.message, stack: error.stack });
        return { code: 500, message: "Failed to process OIDC login: " + error.message };
    }
};

module.exports.createLogoutUrlForSession = async (session) => {
    if (!session?.oidcProviderId || !session.oidcIdTokenEncrypted
        || !session.oidcIdTokenIV || !session.oidcIdTokenAuthTag) return null;

    const provider = await OIDCProvider.findByPk(session.oidcProviderId);
    if (!provider) throw new Error("OIDC provider is no longer available");

    const idToken = decrypt(
        session.oidcIdTokenEncrypted,
        session.oidcIdTokenIV,
        session.oidcIdTokenAuthTag,
    );

    return buildOIDCLogoutUrl(provider, idToken);
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

