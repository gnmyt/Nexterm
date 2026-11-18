const { Router } = require("express");
const Joi = require("joi");
const { route } = require("../utils/route");
const { objectList, message, created } = require("../validations/common");
const { listIdentities, createIdentity, deleteIdentity, updateIdentity, moveIdentityToOrganization } = require("../controllers/identity");
const { createIdentityValidation, updateIdentityValidation, moveIdentityValidation } = require("../validations/identity");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("../controllers/audit");

const app = Router();


app.get("/list", route({
    summary: "List identities",
    description: "Returns the personal identities of the account and the identities of every organization it is a member of. Secrets are never returned.",
    returns: objectList,
}), async (req, res) => {
    res.json(await listIdentities(req.user.id, { withUsage: true }));
});

app.put("/", route({
    summary: "Create identity",
    description: "Creates credentials that entries can connect with. Without an `organizationId` the identity is personal, with one it is shared with that organization.",
    body: createIdentityValidation,
    returns: created,
}), async (req, res) => {
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

app.delete("/:identityId", route({
    summary: "Delete identity",
    description: "Permanently removes an identity. Personal identities can only be deleted by their owner.",
    returns: message,
}), async (req, res) => {
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

app.patch("/:identityId", route({
    summary: "Update identity",
    description: "Changes the name, username or credentials of an identity. Only the fields you send are changed.",
    body: updateIdentityValidation,
    returns: message,
}), async (req, res) => {
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

app.post("/:identityId/move", route({
    summary: "Move identity to organization",
    description: "Turns a personal identity into an organization identity. Only the owner of the identity can do this.",
    body: moveIdentityValidation,
    returns: message.keys({ identity: Joi.object().unknown(true) }),
}), async (req, res) => {
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