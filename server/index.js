const express = require("express");
const path = require("path");
const db = require("./utils/database");
const packageJson = require("../package.json");
const MigrationRunner = require("./utils/migrationRunner");
const { authenticate } = require("./middlewares/auth");
const expressWs = require("express-ws");
const { startPVEUpdater } = require("./utils/pveUpdater");
const { ensureInternalProvider } = require("./controllers/oidc");
const monitoringService = require("./utils/monitoringService");
const {
    refreshAppSources,
    startAppUpdater,
    insertOfficialSource,
} = require("./controllers/appSource");
const { isAdmin } = require("./middlewares/permission");
require("./utils/folder");

process.on("uncaughtException", (err) => require("./utils/errorHandling")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;

const app = expressWs(express()).app;

app.disable("x-powered-by");
app.use(express.json());

app.use("/api/service", require("./routes/service"));
app.use("/api/accounts", require("./routes/account"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/oidc", require("./routes/oidc"));

app.ws("/api/servers/sshd", require("./routes/sshd"));
app.ws("/api/servers/sftp", require("./routes/sftp"));
app.ws("/api/servers/pve-lxc", require("./routes/pveLXC"));
app.ws("/api/servers/pve-qemu", require("./routes/pveQEMU"));

app.use("/api/servers/guacd", require("./middlewares/guacamole"));
app.use("/api/servers/sftp-download", require("./routes/sftpDownload"));

app.use("/api/users", authenticate, isAdmin, require("./routes/users"));
app.use("/api/ai", authenticate, require("./routes/ai"));
app.use("/api/sessions", authenticate, require("./routes/session"));
app.use("/api/folders", authenticate, require("./routes/folder"));
app.use("/api/servers", authenticate, require("./routes/server"));
app.use("/api/monitoring", authenticate, require("./routes/monitoring"));
app.use("/api/pve-servers", authenticate, require("./routes/pveServer"));
app.use("/api/identities", authenticate, require("./routes/identity"));
app.use("/api/snippets", authenticate, require("./routes/snippet"));
app.use("/api/organizations", authenticate, require("./routes/organization"));

app.ws("/api/apps/installer", require("./routes/appInstaller"));
app.use("/api/apps", authenticate, require("./routes/apps"));

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../dist")));

    app.get("*name", (req, res) =>
        res.sendFile(path.join(__dirname, "../dist", "index.html"))
    );
} else {
    require("dotenv").config();
    app.get("*name", (req, res) =>
        res.status(500).sendFile(path.join(__dirname, "templates", "env.html"))
    );
}

if (!process.env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY environment variable is not set. Please set it to a random hex string.");

console.log(`Starting Nexterm version ${packageJson.version} in ${process.env.NODE_ENV || 'development'} mode...`);
console.log(`🛈 Running on Node.js ${process.version}\n`);

db.authenticate()
    .catch((err) => {
        console.error(
            "Could not open the database file. Maybe it is damaged?: " +
                err.message
        );
        process.exit(111);
    })
    .then(async () => {
        console.log(
            "Successfully connected to the database " +
                (process.env.DB_TYPE === "mysql" ? "server" : "file")
        );

        const migrationRunner = new MigrationRunner();
        await migrationRunner.runMigrations();

        await ensureInternalProvider();

        startPVEUpdater();

        startAppUpdater();

        await insertOfficialSource();

        await refreshAppSources();

        monitoringService.start();

        app.listen(APP_PORT, () =>
            console.log(`Server listening on port ${APP_PORT}`)
        );
    });

process.on("SIGINT", async () => {
    console.log("Shutting down the server...");

    monitoringService.stop();

    await db.close();

    process.exit(0);
});
