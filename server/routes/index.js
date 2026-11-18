const express = require("express");
const { authenticate } = require("../middlewares/auth");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");

module.exports = (app) => {
    app.use("/api/transfers", require("./transfer"));
    app.use(express.json());

    app.use("/api/service", require("./service"));
    app.use("/api/accounts", require("./account"));
    app.use("/api/accounts/passkeys", require("./passkey"));
    app.use("/api/accounts/api-keys", require("./apiKey"));
    app.use("/api/auth", require("./auth"));
    app.use("/api/auth", require("./authProviders"));

    app.use("/api/entries/sftp", require("./sftp"));

    app.use("/api/users", authenticate, requirePermission(Permission.USERS_VIEW), require("./users"));
    app.use("/api/permissions", authenticate, requirePermission(Permission.PERMISSIONS_MANAGE), require("./permissions"));
    app.use("/api/sources", authenticate, requirePermission(Permission.SETTINGS_SOURCES), require("./source"));
    app.use("/api/ai", authenticate, require("./ai"));
    app.use("/api/sessions", authenticate, require("./session"));
    app.use("/api/connections", authenticate, require("./serverSession"));
    app.use("/api/folders", authenticate, require("./folder"));
    app.use("/api/entries", authenticate, require("./entry"));
    app.use("/api/monitoring", authenticate, require("./monitoring"));
    app.use("/api/integrations", authenticate, require("./integration"));
    app.use("/api/audit", authenticate, require("./audit"));
    app.use("/api/identities", authenticate, require("./identity"));
    app.use("/api/trusted-hosts", authenticate, require("./trustedHost"));
    app.use("/api/snippets", authenticate, require("./snippet"));
    app.use("/api/organizations", authenticate, require("./organization"));
    app.use("/api/tags", authenticate, require("./tag"));
    app.use("/api/keymaps", authenticate, require("./keymap"));
    app.use("/api/backup/export", require("./backupExport"));
    app.use("/api/backup", authenticate, requirePermission(Permission.SETTINGS_BACKUP), require("./backup"));
    app.use("/api/engines", authenticate, requirePermission(Permission.SETTINGS_ENGINES), require("./engine"));

    app.use("/api/scripts", authenticate, require("./scripts"));
    app.use("/api/themes", authenticate, require("./theme"));
    app.use("/api/share", require("./share"));
    app.use("/api/mcp", authenticate, require("./mcp"));
};
