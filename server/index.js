const express = require("express");
const path = require("path");
const db = require("./utils/database");
const packageJson = require("../package.json");
const MigrationRunner = require("./utils/migrationRunner");
const { authenticate } = require("./middlewares/auth");
const expressWs = require("express-ws");
const { startStatusChecker, stopStatusChecker } = require("./utils/statusChecker");
const { ensureInternalProvider } = require("./controllers/oidc");
const monitoringService = require("./utils/monitoringService");
const { generateOpenAPISpec } = require("./openapi");
const { isAdmin } = require("./middlewares/permission");
const logger = require("./utils/logger");
require("./utils/folder");

process.on("uncaughtException", (err) => require("./utils/errorHandling")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;

const app = expressWs(express()).app;

generateOpenAPISpec(app);

app.disable("x-powered-by");
app.use(express.json());

app.use("/api/service", require("./routes/service"));
app.use("/api/accounts", require("./routes/account"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/oidc", require("./routes/oidc"));

// Unified WebSocket endpoints
app.ws("/api/ws/term", require("./routes/term"));
app.ws("/api/ws/guac", require("./routes/guac"));
app.ws("/api/ws/sftp", require("./routes/sftpWS"));

// SFTP download endpoint
app.use("/api/entries/sftp-download", require("./routes/sftpDownload"));

app.use("/api/users", authenticate, isAdmin, require("./routes/users"));
app.use("/api/ai", authenticate, require("./routes/ai"));
app.use("/api/sessions", authenticate, require("./routes/session"));
app.use("/api/connections", authenticate, require("./routes/serverSession"));
app.use("/api/folders", authenticate, require("./routes/folder"));
app.use("/api/entries", authenticate, require("./routes/entry"));
app.use("/api/monitoring", authenticate, require("./routes/monitoring"));
app.use("/api/integrations", authenticate, require("./routes/integration"));
app.use("/api/audit", authenticate, require("./routes/audit"));
app.use("/api/identities", authenticate, require("./routes/identity"));
app.use("/api/snippets", authenticate, require("./routes/snippet"));
app.use("/api/organizations", authenticate, require("./routes/organization"));
app.use("/api/tags", authenticate, require("./routes/tag"));
app.use("/api/keymaps", authenticate, require("./routes/keymap"));

app.ws("/api/scripts/executor", require("./routes/scriptExecutor"));
app.use("/api/scripts", authenticate, require("./routes/scripts"));

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../dist")));

    app.get("*name", (req, res) =>
        res.sendFile(path.join(__dirname, "../dist", "index.html"))
    );
} else {
    require("dotenv").config({ quiet: true });
    app.get("*name", (req, res) =>
        res.status(500).sendFile(path.join(__dirname, "templates", "env.html"))
    );
}

if (!process.env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY environment variable is not set. Please set it to a random hex string.");

logger.system(`Starting Nexterm version ${packageJson.version} in ${process.env.NODE_ENV || 'development'} mode`);
logger.system(`Running on Node.js ${process.version}`);

db.authenticate()
    .catch((err) => {
        logger.error("Could not connect to database", { error: err.message });
        process.exit(111);
    })
    .then(async () => {
        logger.system(`Successfully connected to database ${process.env.DB_TYPE === "mysql" ? "server" : "file"}`);

        const migrationRunner = new MigrationRunner();
        await migrationRunner.runMigrations();

        await ensureInternalProvider();

        startStatusChecker();

        monitoringService.start();

        app.listen(APP_PORT, () =>
            logger.system(`Server listening on port ${APP_PORT}`)
        );
    });

process.on("SIGINT", async () => {
    logger.system("Shutting down server");

    monitoringService.stop();
    stopStatusChecker();

    await db.close();

    process.exit(0);
});
