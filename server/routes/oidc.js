const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const { isAdmin } = require("../middlewares/permission");
const {
    listProviders,
    getProvider,
    createProvider,
    updateProvider,
    deleteProvider,
    initiateOIDCLogin,
    handleOIDCCallback,
} = require("../controllers/oidc");
const { validateSchema } = require("../utils/schema");
const { oidcProviderValidation, oidcProviderUpdateValidation } = require("../validations/oidc");

const app = Router();

/**
 * GET /oidc/providers
 * @summary List Public OIDC Providers
 * @description Retrieves a list of all enabled OIDC authentication providers available for user login. Only returns public information.
 * @tags OIDC
 * @produces application/json
 * @return {array} 200 - List of enabled OIDC providers
 */
app.get("/providers", async (req, res) => {
    try {
        const providers = await listProviders(false);
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * GET /oidc/admin/providers
 * @summary List All OIDC Providers (Admin)
 * @description Retrieves detailed information about all OIDC providers including configuration details. Admin access required.
 * @tags OIDC
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of all OIDC providers with details
 * @return {object} 403 - Admin access required
 */
app.get("/admin/providers", authenticate, isAdmin, async (req, res) => {
    try {
        const providers = await listProviders(false);
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * GET /oidc/admin/providers/{id}
 * @summary Get OIDC Provider Details (Admin)
 * @description Retrieves detailed configuration for a specific OIDC provider. Client secrets are masked for security. Admin access required.
 * @tags OIDC
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the OIDC provider
 * @return {object} 200 - OIDC provider details with masked secrets
 * @return {object} 404 - Provider not found
 * @return {object} 403 - Admin access required
 */
app.get("/admin/providers/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const provider = await getProvider(req.params.id);
        if (!provider)
            return res.status(404).json({ message: "Provider not found" });

        provider.clientSecret = provider.clientSecret ? "********" : null;
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * PUT /oidc/admin/providers
 * @summary Create OIDC Provider (Admin)
 * @description Creates a new OIDC authentication provider with specified configuration including client credentials and endpoints. Admin access required.
 * @tags OIDC
 * @produces application/json
 * @security BearerAuth
 * @param {OidcProvider} request.body.required - OIDC provider configuration including client ID, secret, and endpoints
 * @return {object} 201 - Provider created successfully with new provider ID
 * @return {object} 403 - Admin access required
 */
app.put("/admin/providers", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, oidcProviderValidation, req.body)) return;

        const provider = await createProvider(req.body);
        res.status(201).json({ message: "Provider created successfully", id: provider.id });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * PATCH /oidc/admin/providers/{id}
 * @summary Update OIDC Provider (Admin)
 * @description Updates an existing OIDC provider's configuration such as endpoints, client credentials, or enabled status. Admin access required.
 * @tags OIDC
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the OIDC provider to update
 * @param {OidcProviderUpdate} request.body.required - Updated OIDC provider configuration fields
 * @return {object} 200 - Provider successfully updated
 * @return {object} 404 - Provider not found
 * @return {object} 403 - Admin access required
 */
app.patch("/admin/providers/:id", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, oidcProviderUpdateValidation, req.body)) return;

        const result = await updateProvider(req.params.id, req.body);
        if (result.code)
            return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * DELETE /oidc/admin/providers/{id}
 * @summary Delete OIDC Provider (Admin)
 * @description Permanently removes an OIDC authentication provider. Users who authenticated through this provider may lose access. Admin access required.
 * @tags OIDC
 * @produces application/json
 * @security BearerAuth
 * @param {string} id.path.required - The unique identifier of the OIDC provider to delete
 * @return {object} 200 - Provider successfully deleted
 * @return {object} 404 - Provider not found
 * @return {object} 403 - Admin access required
 */
app.delete("/admin/providers/:id", authenticate, isAdmin, async (req, res) => {
    try {
        const result = await deleteProvider(req.params.id);
        if (result.code)
            return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * POST /oidc/login/{providerId}
 * @summary Initiate OIDC Login
 * @description Initiates the OIDC authentication flow for a specific provider. Returns the authorization URL that users should be redirected to.
 * @tags OIDC
 * @produces application/json
 * @param {string} providerId.path.required - The unique identifier of the OIDC provider
 * @return {object} 200 - Authorization URL for OIDC login
 * @return {object} 404 - Provider not found or disabled
 */
app.post("/login/:providerId", async (req, res) => {
    try {
        const result = await initiateOIDCLogin(req.params.providerId);
        if (result.code)
            return res.status(result.code).json({ message: result.message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * GET /oidc/callback
 * @summary OIDC Authentication Callback
 * @description Handles the callback from OIDC providers after user authentication. Processes the authorization code and creates a user session.
 * @tags OIDC
 * @produces text/html
 * @param {string} code.query.required - Authorization code from OIDC provider
 * @param {string} state.query.required - State parameter for CSRF protection
 * @return {redirect} 302 - Redirect to application with token or error
 */
app.get("/callback", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.status(400).json({ message: "Missing required parameters" });
        }

        const userInfo = { ip: req.ip, userAgent: req.headers["user-agent"], };

        const result = await handleOIDCCallback(req.query, userInfo);

        if (result.code) {
            return res.redirect(`/?error=${encodeURIComponent(result.message)}`);
        }

        res.redirect(`/?token=${result.token}`);
    } catch (error) {
        res.redirect(`/?error=${encodeURIComponent("Authentication failed")}`);
    }
});

module.exports = app;