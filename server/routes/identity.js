const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { listIdentities, createIdentity, deleteIdentity, updateIdentity } = require("../controllers/identity");
const { createIdentityValidation, updateIdentityValidation } = require("../validations/identity");

const app = Router();

/**
 * GET /identity/list
 * @summary List User Identities
 * @description Retrieves a list of all authentication identities (SSH keys, credentials) created by the authenticated user for server connections.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user identities
 */
app.get("/list", async (req, res) => {
    res.json(await listIdentities(req.user.id));
});

/**
 * PUT /identity
 * @summary Create New Identity
 * @description Creates a new authentication identity for server connections, such as SSH keys or username/password credentials.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @param {CreateIdentity} request.body.required - Identity configuration including type, credentials, and connection details
 * @return {object} 200 - Identity successfully created with new identity ID
 * @return {object} 400 - Invalid identity configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createIdentityValidation, req.body)) return;

    const identity = await createIdentity(req.user.id, req.body);
    if (identity?.code) return res.json(identity);

    res.json({ message: "Identity got successfully created", id: identity.id });
});

/**
 * DELETE /identity/{identityId}
 * @summary Delete Identity
 * @description Permanently removes an authentication identity from the user's account. This will affect any servers using this identity.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @param {string} identityId.path.required - The unique identifier of the identity to delete
 * @return {object} 200 - Identity successfully deleted
 * @return {object} 404 - Identity not found
 */
app.delete("/:identityId", async (req, res) => {
    const identity = await deleteIdentity(req.user.id, req.params.identityId);
    if (identity?.code) return res.json(identity);

    res.json({ message: "Identity got successfully deleted" });
});

/**
 * PATCH /identity/{identityId}
 * @summary Update Identity
 * @description Updates an existing authentication identity's configuration such as credentials or connection settings.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @param {string} identityId.path.required - The unique identifier of the identity to update
 * @param {UpdateIdentity} request.body.required - Updated identity configuration fields
 * @return {object} 200 - Identity successfully updated
 * @return {object} 404 - Identity not found
 */
app.patch("/:identityId", async (req, res) => {
    if (validateSchema(res, updateIdentityValidation, req.body)) return;

    const identity = await updateIdentity(req.user.id, req.params.identityId, req.body);
    if (identity?.code) return res.json(identity);

    res.json({ message: "Identity got successfully edited" });
});

module.exports = app;