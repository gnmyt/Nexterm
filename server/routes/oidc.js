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

app.get("/providers", async (req, res) => {
    try {
        const providers = await listProviders(false);
        res.json(providers.filter(p => p.enabled));
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/admin/providers", authenticate, isAdmin, async (req, res) => {
    try {
        const providers = await listProviders(false);
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

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

app.put("/admin/providers", authenticate, isAdmin, async (req, res) => {
    try {
        if (validateSchema(res, oidcProviderValidation, req.body)) return;

        const provider = await createProvider(req.body);
        res.status(201).json({ message: "Provider created successfully", id: provider.id });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
});

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