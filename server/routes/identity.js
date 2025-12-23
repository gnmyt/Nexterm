const { Router } = require("express");
const { validateSchema } = require("../utils/schema");
const { listIdentities, createIdentity, deleteIdentity, updateIdentity, moveIdentityToOrganization, getIdentity, getIdentityCredentials } = require("../controllers/identity");
const { createIdentityValidation, updateIdentityValidation, moveIdentityValidation } = require("../validations/identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const app = Router();

/**
 * GET /identity/list
 * @summary List User Identities
 * @description Retrieves a list of all authentication identities (SSH keys, credentials) available to the authenticated user. Returns both personal identities and organization identities the user has access to.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of user identities with scope indication (personal/organization)
 */
app.get("/list", async (req, res) => {
    res.json(await listIdentities(req.user.id));
});

/**
 * PUT /identity
 * @summary Create New Identity
 * @description Creates a new authentication identity for server connections. Can be personal (bound to account) or organizational (shared with organization members).
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @param {CreateIdentity} request.body.required - Identity configuration including type, credentials, and optional organizationId
 * @return {object} 200 - Identity successfully created with new identity ID
 * @return {object} 400 - Invalid identity configuration
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createIdentityValidation, req.body)) return;

    const identity = await createIdentity(req.user.id, req.body);
    if (identity?.code) return res.json(identity);

    await createAuditLog({
        accountId: req.user.id,
        organizationId: req.body.organizationId || null,
        action: AUDIT_ACTIONS.IDENTITY_CREATE,
        resource: RESOURCE_TYPES.IDENTITY,
        resourceId: identity.id,
        details: {
            identityName: req.body.name,
            identityType: req.body.type,
            scope: req.body.organizationId ? 'organization' : 'personal',
        },
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
    });

    res.json({ message: "Identity got successfully created", id: identity.id });
});

/**
 * DELETE /identity/{identityId}
 * @summary Delete Identity
 * @description Permanently removes an authentication identity. Personal identities can only be deleted by the owner. Organization identities can be deleted by any organization member.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @param {string} identityId.path.required - The unique identifier of the identity to delete
 * @return {object} 200 - Identity successfully deleted
 * @return {object} 404 - Identity not found
 */
app.delete("/:identityId", async (req, res) => {
    const result = await deleteIdentity(req.user.id, req.params.identityId);
    if (result?.code) return res.json(result);

    await createAuditLog({
        accountId: req.user.id,
        organizationId: result.identity?.organizationId || null,
        action: AUDIT_ACTIONS.IDENTITY_DELETE,
        resource: RESOURCE_TYPES.IDENTITY,
        resourceId: req.params.identityId,
        details: {
            identityName: result.identity?.name,
            identityType: result.identity?.type,
        },
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
    });

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

    const result = await updateIdentity(req.user.id, req.params.identityId, req.body);
    if (result?.code) return res.json(result);

    await createAuditLog({
        accountId: req.user.id,
        organizationId: result.identity?.organizationId || null,
        action: AUDIT_ACTIONS.IDENTITY_UPDATE,
        resource: RESOURCE_TYPES.IDENTITY,
        resourceId: req.params.identityId,
        details: {
            identityName: result.identity?.name,
            identityType: result.identity?.type,
            updatedFields: Object.keys(req.body).filter(key => !['password', 'sshKey', 'passphrase'].includes(key)),
        },
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
    });

    res.json({ message: "Identity got successfully edited" });
});

/**
 * POST /identity/{identityId}/move
 * @summary Move Identity to Organization
 * @description Moves a personal identity to an organization, making it accessible to all organization members. Only the identity owner can perform this action.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 * @param {string} identityId.path.required - The unique identifier of the personal identity to move
 * @param {MoveIdentity} request.body.required - Target organization configuration
 * @return {object} 200 - Identity successfully moved to organization
 * @return {object} 403 - Not authorized to move this identity or access target organization
 * @return {object} 404 - Identity not found
 */
app.post("/:identityId/move", async (req, res) => {
    if (validateSchema(res, moveIdentityValidation, req.body)) return;

    const result = await moveIdentityToOrganization(req.user.id, req.params.identityId, req.body.organizationId);
    if (result?.code) return res.json(result);

    await createAuditLog({
        accountId: req.user.id,
        organizationId: req.body.organizationId,
        action: AUDIT_ACTIONS.IDENTITY_UPDATE,
        resource: RESOURCE_TYPES.IDENTITY,
        resourceId: req.params.identityId,
        details: {
            identityName: result.identity?.name,
            targetOrganizationId: req.body.organizationId,
        },
        ipAddress: req.ip,
        userAgent: req.headers?.["user-agent"],
    });

    res.json({ message: "Identity successfully moved to organization", identity: result.identity });
});

module.exports = app;

/**
 * GET /identity/{identityId}/credentials
 * @summary Get identity credentials
 * @description Retrieves stored credentials (password, ssh-key, passphrase) for a specific identity the user has access to.
 * @tags Identity
 * @produces application/json
 * @security BearerAuth
 */
app.get("/:identityId/credentials", async (req, res) => {
    const identity = await getIdentity(req.user.id, req.params.identityId);
    if (identity?.code) return res.json(identity);

    const creds = await getIdentityCredentials(req.params.identityId);

    // Audit credential access (do not include secrets in audit details)
    try {
        await createAuditLog({
            accountId: req.user.id,
            organizationId: identity.organizationId || null,
            action: AUDIT_ACTIONS.IDENTITY_CREDENTIALS_ACCESS,
            resource: RESOURCE_TYPES.IDENTITY,
            resourceId: identity.id,
            details: { identityName: identity.name, identityType: identity.type },
            ipAddress: req.ip,
            userAgent: req.headers?.["user-agent"],
        });
    } catch (e) {
        // swallow audit errors but log server-side
        console.error('Failed to record credential access audit', e);
    }

    res.json(creds);
});