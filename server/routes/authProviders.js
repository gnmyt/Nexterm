const { Router } = require("express");
const { route } = require("../utils/route");
const { objectList, acceptFingerprintValidation } = require("../validations/common");
const { authenticate } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");
const oidc = require("../controllers/oidc");
const ldap = require("../controllers/ldap");
const { oidcProviderValidation, oidcProviderUpdateValidation } = require("../validations/oidc");
const { ldapProviderValidation, ldapProviderUpdateValidation } = require("../validations/ldap");

const Joi = require("joi");
const { getSessionSettings, updateSessionSettings } = require("../utils/loginSession");

const app = Router();

const sessionSettingsValidation = Joi.object({
    idleTimeoutDays: Joi.number().integer().min(0).max(3650),
    maxLifetimeDays: Joi.number().integer().min(0).max(3650),
}).min(1);

app.get("/sessions/settings", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Get session limits",
    description: "Returns after how many idle days and after how many days in total a login session ends. 0 means never.",
    tag: "Auth providers",
}), async (req, res) => {
    res.json(await getSessionSettings());
});

app.patch("/sessions/settings", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Update session limits",
    description: "Updates after how many idle days and after how many days in total a login session ends. 0 means never.",
    tag: "Auth providers",
    body: sessionSettingsValidation,
}), async (req, res) => {
    res.json(await updateSessionSettings(req.body));
});

app.get("/providers", route({
    summary: "List public auth providers",
    description: "Retrieves all authentication providers for the login dialog. Returns enabled OIDC and LDAP providers along with internal auth status.",
    tag: "Auth providers",
    returns: objectList,
}), async (req, res) => {
    try {
        const providers = await oidc.listProviders(false, true);
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/providers/admin", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "List all auth providers (admin)",
    description: "Retrieves all OIDC and LDAP providers with their full configurations for administrative management.",
    tag: "Auth providers",
}), async (req, res) => {
    try {
        const [oidcProviders, ldapProviders] = await Promise.all([
            oidc.listProviders(false),
            ldap.listProviders(false),
        ]);
        res.json({ oidc: oidcProviders, ldap: ldapProviders });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/providers/admin/organizations", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "List organizations for group mapping",
    description: "Retrieves a lightweight list of every organization, used to configure OIDC group-to-organization mappings.",
    tag: "Auth providers",
    returns: objectList,
}), async (req, res) => {
    try {
        res.json(await oidc.listOrganizationsForMapping());
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/providers/admin/oidc/:id", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Get OIDC provider",
    description: "Retrieves a specific OIDC provider by ID with its configuration. Client secret is masked.",
    tag: "Auth providers",
}), async (req, res) => {
    try {
        const provider = await oidc.getProvider(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });
        provider.clientSecret = provider.clientSecret ? "********" : null;
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put("/providers/admin/oidc", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Create OIDC provider",
    status: 201,
    description: "Creates a new OIDC authentication provider with the specified configuration.",
    tag: "Auth providers",
    body: oidcProviderValidation,
}), async (req, res) => {
    try {
        const provider = await oidc.createProvider(req.body);
        res.status(201).json({ message: "Provider created successfully", id: provider.id });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.patch("/providers/admin/oidc/:id", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Update OIDC provider",
    description: "Updates an existing OIDC provider's configuration. At least one provider must remain enabled.",
    tag: "Auth providers",
    body: oidcProviderUpdateValidation,
}), async (req, res) => {
    try {
        const result = await oidc.updateProvider(req.params.id, req.body);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.delete("/providers/admin/oidc/:id", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Delete OIDC provider",
    description: "Deletes an OIDC provider. Cannot delete internal provider or the last enabled provider.",
    tag: "Auth providers",
}), async (req, res) => {
    try {
        const result = await oidc.deleteProvider(req.params.id);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/providers/admin/ldap/:id", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Get LDAP provider",
    description: "Retrieves a specific LDAP provider by ID with its configuration. Bind password is masked.",
    tag: "Auth providers",
}), async (req, res) => {
    try {
        const provider = await ldap.getProvider(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });
        provider.bindPassword = provider.bindPassword ? "********" : null;
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.put("/providers/admin/ldap", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Create LDAP provider",
    status: 201,
    description: "Creates a new LDAP authentication provider with the specified configuration.",
    tag: "Auth providers",
    body: ldapProviderValidation,
}), async (req, res) => {
    try {
        const provider = await ldap.createProvider(req.body);
        res.status(201).json({ message: "Provider created successfully", id: provider.id });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.patch("/providers/admin/ldap/:id", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Update LDAP provider",
    description: "Updates an existing LDAP provider's configuration. At least one provider must remain enabled.",
    tag: "Auth providers",
    body: ldapProviderUpdateValidation,
}), async (req, res) => {
    try {
        const result = await ldap.updateProvider(req.params.id, req.body);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.delete("/providers/admin/ldap/:id", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Delete LDAP provider",
    description: "Deletes an LDAP provider. Cannot delete if it's the last enabled provider.",
    tag: "Auth providers",
}), async (req, res) => {
    try {
        const result = await ldap.deleteProvider(req.params.id);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/providers/admin/ldap/:id/test", authenticate, requirePermission(Permission.SETTINGS_AUTH_PROVIDERS), route({
    summary: "Test LDAP connection",
    description: "Tests the connection to an LDAP server using the provider's configuration.",
    tag: "Auth providers",
    body: acceptFingerprintValidation,
}), async (req, res) => {
    try {
        const result = await ldap.testConnection(req.params.id, req.user.id, req.body.acceptFingerprint || null);
        if (result.code) return res.status(result.code).json({ message: result.message, untrustedPeer: result.untrustedPeer });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/oidc/login/:providerId", route({
    summary: "Initiate OIDC login",
    description: "Initiates the OIDC authentication flow for the specified provider. Returns an authorization URL to redirect the user.",
    tag: "Auth providers",
}), async (req, res) => {
    try {
        const result = await oidc.initiateOIDCLogin(req.params.providerId);
        if (result.code) return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/oidc/callback", route({
    summary: "OIDC callback",
    description: "Handles the OIDC callback after user authentication. Redirects to the app with a session token or error.",
    tag: "Auth providers",
    query: Joi.object({
        code: Joi.string().required().description("Authorization code from OIDC provider"),
        state: Joi.string().required().description("State parameter for CSRF protection"),
    }),
}), async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) return res.status(400).json({ message: "Missing required parameters" });

        const userInfo = { ip: req.ip, userAgent: req.headers["user-agent"] };
        const result = await oidc.handleOIDCCallback(req.query, userInfo);

        if (result.code) return res.redirect(`/?error=${encodeURIComponent(result.message)}`);
        res.redirect(`/?token=${result.token}`);
    } catch (error) {
        res.redirect(`/?error=${encodeURIComponent("Authentication failed")}`);
    }
});

app.get("/oidc/logout/callback", route({
    summary: "OIDC logout callback",
    description: "Returns the browser to Nexterm after the identity provider completes logout.",
    tag: "Auth providers",
}), (req, res) => {
    res.redirect("/");
});

module.exports = app;
