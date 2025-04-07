const client = require("openid-client");
const OIDCProvider = require("../models/OIDCProvider");
const Account = require("../models/Account");
const Session = require("../models/Session");
const { genSalt, hash } = require("bcrypt");
const crypto = require("crypto");

const stateStore = new Map();

module.exports.listProviders = async (includeSecret = false) => {
    const providers = await OIDCProvider.findAll();

    if (!includeSecret) {
        return providers.map(provider => ({
            id: provider.id, name: provider.name, issuer: provider.issuer,
            clientId: provider.clientId, redirectUri: provider.redirectUri, scope: provider.scope,
            enabled: provider.enabled, emailAttribute: provider.emailAttribute,
            usernameAttribute: provider.usernameAttribute, firstNameAttribute: provider.firstNameAttribute,
            lastNameAttribute: provider.lastNameAttribute,
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

    await OIDCProvider.update(data, { where: { id: providerId } });
    return provider;
};

module.exports.deleteProvider = async (providerId) => {
    const provider = await OIDCProvider.findByPk(providerId);
    if (!provider) {
        return { code: 404, message: "Provider not found" };
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

        stateStore.set(state, { nonce, providerId, timestamp: Date.now() });

        for (const [key, value] of stateStore.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                stateStore.delete(key);
            }
        }

        const parameters = { redirect_uri: provider.redirectUri, scope: provider.scope, state, nonce };
        const redirectTo = client.buildAuthorizationUrl(configuration, parameters);

        return { url: redirectTo.href };
    } catch (error) {
        return { code: 500, message: error.message };
    }
};

module.exports.handleOIDCCallback = async (query, userInfo) => {
    try {
        const storedData = stateStore.get(query.state);
        if (!storedData) {
            return { code: 400, message: "Invalid or expired state" };
        }

        stateStore.delete(query.state);

        const { providerId, nonce } = storedData;
        const provider = await OIDCProvider.findByPk(providerId);

        if (!provider) {
            return { code: 404, message: "Provider not found" };
        }

        const configuration = await client.discovery(new URL(provider.issuer), provider.clientId, provider.clientSecret);

        const url = new URL(provider.redirectUri + "?" + new URLSearchParams(query).toString());

        const tokens = await client.authorizationCodeGrant(configuration, url, {
            expectedState: query.state,
            expectedNonce: nonce,
        });

        const protectedResourceResponse = await client.fetchProtectedResource(
            configuration,
            tokens.access_token,
            new URL(configuration.serverMetadata().userinfo_endpoint),
        );

        const userinfo = await protectedResourceResponse.json();

        const username = userinfo[provider.usernameAttribute] || userinfo.sub;
        const email = userinfo[provider.emailAttribute];
        const firstName = userinfo[provider.firstNameAttribute] || "";
        const lastName = userinfo[provider.lastNameAttribute] || "";

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
                email: String(email),
                role: "user",
            });
        } else {
            await Account.update({
                firstName: String(firstName),
                lastName: String(lastName),
                email: String(email),
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
        return { code: 500, message: "Failed to process OIDC login: " + error.message };
    }
};