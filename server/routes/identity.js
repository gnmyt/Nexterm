const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { listIdentities, createIdentity, deleteIdentity, updateIdentity } = require("../controllers/identity");
const { createIdentityValidation, updateIdentityValidation } = require("../validations/identity");

const app = Router();

app.get("/list", async (req, res) => {
    res.json(await listIdentities(req.user.id));
});

app.put("/", async (req, res) => {
    if (validateSchema(res, createIdentityValidation, req.body)) return;

    const identity = await createIdentity(req.user.id, req.body);
    if (identity?.code) return res.json(identity);

    res.json({ message: "Identity got successfully created", id: identity.id });
});

app.delete("/:identityId", async (req, res) => {
    const identity = await deleteIdentity(req.user.id, req.params.identityId);
    if (identity?.code) return res.json(identity);

    res.json({ message: "Identity got successfully deleted" });
});

app.patch("/:identityId", async (req, res) => {
    if (validateSchema(res, updateIdentityValidation, req.body)) return;

    const identity = await updateIdentity(req.user.id, req.params.identityId, req.body);
    if (identity?.code) return res.json(identity);

    res.json({ message: "Identity got successfully edited" });
});

module.exports = app;