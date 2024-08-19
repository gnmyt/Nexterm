const express = require('express');
const path = require('path');
const db = require("./utils/database");
const { authenticate } = require('./middlewares/auth');
require('./utils/folder'); // Create needed data folders

process.on('uncaughtException', err => require('./utils/errorHandling')(err));

const APP_PORT = process.env.SERVER_PORT || 6989;

const app = express();

app.disable('x-powered-by');

app.use(express.json());

app.use("/api/accounts", require("./routes/account"));
app.use("/api/auth", require("./routes/auth"));

app.use("/api/sessions", authenticate, require("./routes/session"));
app.use("/api/folders", authenticate, require("./routes/folder"));

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));

    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../dist', 'index.html')));
} else {
    app.get("*", (req, res) => res.status(500).sendFile(path.join(__dirname, 'templates', 'env.html')));
}

db.authenticate().then(async () => {
    console.log("Successfully connected to the database " + (process.env.DB_TYPE === "mysql" ? "server" : "file"));

    await db.sync({ alter: true, force: false });

    app.listen(APP_PORT, () => console.log(`Server listening on port ${APP_PORT}`));
}).catch(err => {
    console.error("Could not open the database file. Maybe it is damaged?: " + err.message);
    process.exit(111);
});