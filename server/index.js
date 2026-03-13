const { loadSecrets } = require("./utils/secrets");
loadSecrets();

const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const db = require("./utils/database");
const packageJson = require("../package.json");
const MigrationRunner = require("./utils/migrationRunner");
const { authenticate } = require("./middlewares/auth");
const expressWs = require("express-ws");
const { startStatusChecker, stopStatusChecker } = require("./utils/statusChecker");
const { ensureInternalProvider } = require("./controllers/oidc");
const monitoringService = require("./utils/monitoringService");
const pveMonitoringService = require("./utils/pveMonitoringService");
const recordingService = require("./utils/recordingService");
const { generateOpenAPISpec } = require("./openapi");
const { isAdmin } = require("./middlewares/permission");
const logger = require("./utils/logger");
const { startSourceSyncService, stopSourceSyncService } = require("./utils/sourceSyncService");
const backupService = require("./utils/backupService");
const controlPlane = require("./lib/controlPlane/ControlPlaneServer");
const SessionManager = require("./lib/SessionManager");
require("./utils/folder");

process.on("uncaughtException", (err) => require("./utils/errorHandling")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;
const HTTPS_PORT = process.env.HTTPS_PORT || 5878;

const CERTS_DIR = path.join(__dirname, "../data/certs");
const CERT_PATH = path.join(CERTS_DIR, "cert.pem");
const KEY_PATH = path.join(CERTS_DIR, "key.pem");

const hasSSLCerts = () => fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

const app = expressWs(express()).app;

generateOpenAPISpec(app);

app.disable("x-powered-by");
app.use(express.json());

app.use("/api/service", require("./routes/service"));
app.use("/api/accounts", require("./routes/account"));
app.use("/api/accounts/passkeys", require("./routes/passkey"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth", require("./routes/authProviders"));

app.ws("/api/ws/term", require("./routes/term"));
app.ws("/api/ws/guac", require("./routes/guac"));
app.ws("/api/ws/sftp", require("./routes/sftpWS"));
app.ws("/api/ws/tunnel", require("./routes/tunnel"));
app.ws("/api/ws/state", require("./routes/state"));

app.use("/api/entries/sftp", require("./routes/sftp"));

app.use("/api/users", authenticate, isAdmin, require("./routes/users"));
app.use("/api/sources", authenticate, isAdmin, require("./routes/source"));
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
app.use("/api/backup/export", require("./routes/backupExport"));
app.use("/api/backup", authenticate, isAdmin, require("./routes/backup"));
app.use("/api/engines", authenticate, isAdmin, require("./routes/engine"));

app.use("/api/scripts", authenticate, require("./routes/scripts"));
app.use("/api/share", require("./routes/share"));

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

if (!process.env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY not found. Set it via Docker secret (/run/secrets/encryption_key) or environment variable.");

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

        pveMonitoringService.start();

        recordingService.start();

        startSourceSyncService();

        backupService.start();

        controlPlane.on("sessionClosed", ({ sessionId, reason }) => {
            logger.info(`Engine session closed: ${sessionId} (reason: ${reason})`);
            SessionManager.remove(sessionId);
        });

        await controlPlane.start();

        app.listen(APP_PORT, () =>
            logger.system(`Server listening on port ${APP_PORT}`)
        );

        if (hasSSLCerts()) {
            try {
                const sslOptions = {
                    cert: fs.readFileSync(CERT_PATH),
                    key: fs.readFileSync(KEY_PATH)
                };

                const httpsServer = https.createServer(sslOptions, app);
                expressWs(app, httpsServer);

                httpsServer.listen(HTTPS_PORT, () =>
                    logger.system(`HTTPS server listening on port ${HTTPS_PORT}`)
                );
            } catch (err) {
                logger.error("Failed to start HTTPS server", { error: err.message });
            }
        }
    });

process.on("SIGINT", async () => {
    logger.system("Shutting down server");

    monitoringService.stop();
    pveMonitoringService.stop();
    recordingService.stop();
    stopStatusChecker();
    stopSourceSyncService();
    backupService.stop();

    controlPlane.stop();

    await db.close();

    process.exit(0);
});
