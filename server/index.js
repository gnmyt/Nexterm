const { loadSecrets } = require("./utils/secrets");
loadSecrets();

const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const https = require("node:https");
const db = require("./utils/database");
const packageJson = require("../package.json");
const MigrationRunner = require("./utils/migrationRunner");
const expressWs = require("express-ws");
const { startStatusChecker, stopStatusChecker } = require("./utils/statusChecker");
const { ensureInternalProvider } = require("./controllers/oidc");
const monitoringService = require("./utils/monitoringService");
const pveMonitoringService = require("./utils/pveMonitoringService");
const integrationSyncService = require("./utils/integrationSyncService");
const recordingService = require("./utils/recordingService");
const { serveOpenAPISpec } = require("./openapi");
const logger = require("./utils/logger");
const { startSourceSyncService, stopSourceSyncService } = require("./utils/sourceSyncService");
const backupService = require("./utils/backupService");
const controlPlane = require("./lib/controlPlane/ControlPlaneServer");
const SessionManager = require("./lib/SessionManager");
const { handleUntrustedPeer } = require("./lib/ConnectionService");
const { ensureLocalEngine } = require("./controllers/engine");
const { ensureCPCerts } = require("./utils/controlPlaneCerts");
const { isDemoMode } = require("./utils/demoMode");
const { seedDemo } = require("./utils/demoSeeder");
const { startGuestCleanup, stopGuestCleanup, cleanupExpiredGuests } = require("./controllers/demo");
require("./utils/folder");

process.on("uncaughtException", (err) => require("./utils/errorHandling")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;
const HTTPS_PORT = process.env.HTTPS_PORT || 5878;

const CERTS_DIR = path.join(__dirname, "../data/certs");
const CERT_PATH = path.join(CERTS_DIR, "cert.pem");
const KEY_PATH = path.join(CERTS_DIR, "key.pem");

const hasSSLCerts = () => fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

const parseTrustProxy = value => {
    if (!value) return false;

    const trimmed = value.trim();
    if (trimmed === "false") return false;
    if (trimmed === "true") {
        logger.warn("TRUST_PROXY=true trusts X-Forwarded-For from any source. Prefer a hop count or address list.");
        return true;
    }
    if (/^\d+$/.test(trimmed)) return Number(trimmed);

    return trimmed;
};

const app = expressWs(express()).app;

serveOpenAPISpec(app);

app.disable("x-powered-by");
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));
require("./routes")(app);

app.ws("/api/ws/term", require("./routes/term"));
app.ws("/api/ws/guac", require("./routes/guac"));
app.ws("/api/ws/sftp", require("./routes/sftpWS"));
app.ws("/api/ws/ai", require("./routes/aiWS"));
app.ws("/api/ws/tunnel", require("./routes/tunnel"));
app.ws("/api/ws/state", require("./routes/state"));

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

        if (isDemoMode()) {
            try {
                await seedDemo();
            } catch (err) {
                logger.error("Could not prepare demo mode", { error: err.message });
                process.exit(1);
            }
            startGuestCleanup();
        } else {
            await cleanupExpiredGuests();
        }

        startStatusChecker();

        monitoringService.start();

        pveMonitoringService.start();

        integrationSyncService.start();

        recordingService.start();

        startSourceSyncService();

        backupService.start();

        if (process.env.LOCAL_ENGINE_TOKEN) {
            await ensureLocalEngine(process.env.LOCAL_ENGINE_TOKEN);
            logger.system("Local engine configured");
        }

        controlPlane.on("sessionClosed", ({ sessionId, reason }) => {
            logger.info(`Engine session closed: ${sessionId} (reason: ${reason})`);
            if (controlPlane.isTrustFailure(sessionId)) return;
            if (reason === "connection lost") {
                SessionManager.remove(sessionId, { code: 4017, reason: "Connection lost" });
            } else {
                SessionManager.remove(sessionId);
            }
        });

        controlPlane.on("connectionError", ({ sessionId, untrustedPeer }) => {
            if (!untrustedPeer) return;
            handleUntrustedPeer(sessionId, untrustedPeer)
                .catch((error) => logger.error("Failed to handle untrusted peer", { sessionId, error: error.message }));
        });

        controlPlane.on("engineDisconnected", ({ engineId, sessionIds }) => {
            logger.warn(`Engine ${engineId} disconnected, cleaning up ${sessionIds.length} sessions`);
            for (const sessionId of sessionIds) {
                SessionManager.markFailed(sessionId, "Connection lost");
                SessionManager.remove(sessionId, { code: 4017, reason: "Connection lost" });
            }
        });

        try {
            controlPlane.setTlsContext(await ensureCPCerts());
        } catch (err) {
            logger.warn("Could not set up control plane TLS certificates, engines will connect unencrypted", { error: err.message });
        }

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
    integrationSyncService.stop();
    recordingService.stop();
    stopStatusChecker();
    stopSourceSyncService();
    backupService.stop();
    stopGuestCleanup();

    controlPlane.stop();

    await db.close();

    process.exit(0);
});
