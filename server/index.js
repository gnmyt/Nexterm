const crypto = require("crypto");
module.exports.GUACD_TOKEN = crypto.randomBytes(16).toString("hex");

const express = require("express");
const path = require("path");
const db = require("./utils/database");
const { authenticate } = require("./middlewares/auth");
const expressWs = require("express-ws");
const { startPVEUpdater } = require("./utils/pveUpdater");
const { startGuacamole } = require("./utils/guacamoleStarter");
const { refreshAppSources, startAppUpdater, insertOfficialSource } = require("./controllers/appSource");
const { isAdmin } = require("./middlewares/permission");
require("./utils/folder");

process.on("uncaughtException", err => require("./utils/errorHandling")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;

const app = expressWs(express()).app;

app.disable("x-powered-by");
app.use(express.json());

app.use("/api/service", require("./routes/service"));
app.use("/api/accounts", require("./routes/account"));
app.use("/api/auth", require("./routes/auth"));

app.ws("/api/servers/sshd", require("./routes/sshd"));
app.ws("/api/servers/sftp", require("./routes/sftp"));
app.ws("/api/servers/pve-lxc", require("./routes/pveLXC"));
app.ws("/api/servers/pve-qemu", require("./routes/pveQEMU"));

app.use("/api/servers/guacd", require("./middlewares/guacamole"));
app.use("/api/servers/sftp-download", require("./routes/sftpDownload"));

app.use("/api/users", authenticate, isAdmin, require("./routes/users"));
app.use("/api/sessions", authenticate, require("./routes/session"));
app.use("/api/folders", authenticate, require("./routes/folder"));
app.use("/api/servers", authenticate, require("./routes/server"));
app.use("/api/pve-servers", authenticate, require("./routes/pveServer"));
app.use("/api/identities", authenticate, require("./routes/identity"));

app.ws("/api/apps/installer", require("./routes/appInstaller"));
app.use("/api/apps", authenticate, require("./routes/apps"));

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../dist")));

    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../dist", "index.html")));
} else {
    app.get("*", (req, res) => res.status(500).sendFile(path.join(__dirname, "templates", "env.html")));
}

db.authenticate().catch(err => {
    console.error("Could not open the database file. Maybe it is damaged?: " + err.message);
    process.exit(111);
}).then(async () => {
    console.log("Successfully connected to the database " + (process.env.DB_TYPE === "mysql" ? "server" : "file"));

    await startGuacamole();

    await db.sync({ alter: true, force: false });

    startPVEUpdater();

    startAppUpdater();

    await insertOfficialSource();

    await refreshAppSources();

    app.listen(APP_PORT, () => console.log(`Server listening on port ${APP_PORT}`));
});

process.on("SIGINT", async () => {
    console.log("Shutting down the server...");

    await db.close();

    process.exit(0);
});