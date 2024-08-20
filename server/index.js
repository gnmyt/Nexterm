const crypto = require("crypto");
module.exports.GUACD_TOKEN = crypto.randomBytes(16).toString("hex");

const express = require("express");
const path = require("path");
const db = require("./utils/database");
const { authenticate, authorizeGuacamole } = require("./middlewares/auth");
const GuacamoleLite = require("guacamole-lite");
const { createProxyMiddleware } = require("http-proxy-middleware");

require("./utils/folder");  // Create needed data folders

process.on("uncaughtException", err => require("./utils/errorHandling")(err));

const APP_PORT = process.env.SERVER_PORT || 6989;

const app = express();

app.disable("x-powered-by");

app.use(express.json());

app.use("/api/accounts", require("./routes/account"));
app.use("/api/auth", require("./routes/auth"));

app.use("/api/sessions", authenticate, require("./routes/session"));
app.use("/api/folders", authenticate, require("./routes/folder"));
app.use("/api/servers", authenticate, require("./routes/server"));
app.use("/api/identities", authenticate, require("./routes/identity"));

new GuacamoleLite({ port: 58391 }, { port: 4822 }, {
    crypt: { cypher: "AES-256-CBC", key: module.exports.GUACD_TOKEN },
    log: { level: 0 },
});

app.use("/api/servers/guacd", createProxyMiddleware({
    changeOrigin: true,
    ws: true,
    router: async (req) => {
        const token = await authorizeGuacamole(req);
        if (!token) return null;
        return "ws://localhost:" + 58391 + "/?token=" + token;
    },
}));

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

    await db.sync({ alter: true, force: false });

    app.listen(APP_PORT, () => console.log(`Server listening on port ${APP_PORT}`));
});