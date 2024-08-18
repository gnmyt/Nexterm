const { Router } = require("express");
const { login, logout } = require("../controllers/auth");
const { loginValidation, tokenValidation } = require("../validations/auth");
const { validateSchema } = require("../utils/schema");

const app = Router();

app.post("/login", async (req, res) => {
    if (validateSchema(res, loginValidation, req.body)) return;

    const session = await login(req.body, {
        ip: req.ip,
        userAgent: req.header("User-Agent") || "None",
    });
    if (session?.code) return res.json(session);

    res
        .header("Authorization", session?.token)
        .json({ ...session, message: "Your session got successfully created" });
});

app.post("/logout", async (req, res) => {
    if (validateSchema(res, tokenValidation, req.body)) return;

    const session = await logout(req.body.token);
    if (session) return res.json(session);

    res.json({ message: "Your session got deleted successfully" });
});

module.exports = app;
