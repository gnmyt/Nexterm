const { Router } = require("express");
const { listUsers, createAccount, deleteAccount, updatePassword, updateRole } = require("../controllers/account");
const { validateSchema } = require("../utils/schema");
const { createUserValidation, updateRoleValidation } = require("../validations/users");
const { createSession } = require("../controllers/session");
const { passwordChangeValidation } = require("../validations/account");

const app = Router();

app.get("/list", async (req, res) => {
    res.json(await listUsers());
});

app.put("/", async (req, res) => {
    if (validateSchema(res, createUserValidation, req.body)) return;

    const account = await createAccount(req.body, false);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully created" });
});

app.post("/:accountId/login", async (req, res) => {
    const account = await createSession(req.params.accountId, req.headers["user-agent"]);
    if (account?.code) return res.json(account);

    res.json({ message: "Session got successfully created", token: account.token });
});

app.delete("/:accountId", async (req, res) => {
    const account = await deleteAccount(req.params.accountId);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully deleted" });
});

app.patch("/:accountId/password", async (req, res) => {
    if (validateSchema(res, passwordChangeValidation, req.body)) return;

    const account = await updatePassword(req.params.accountId, req.body.password);
    if (account?.code) return res.json(account);

    res.json({ message: "Password got successfully updated" });
});

app.patch("/:accountId/role", async (req, res) => {
    try {
        if (req.user.id === parseInt(req.params.accountId))
            return res.json({ code: 107, message: "You cannot change your own role" });

        if (validateSchema(res, updateRoleValidation, req.body)) return;

        const account = await updateRole(req.params.accountId, req.body.role);
        if (account?.code) return res.json(account);

        res.json({ message: "Role got successfully updated" });
    } catch (error) {
        res.json({ code: 109, message: "You need to provide a correct id"});
    }
});

module.exports = app;