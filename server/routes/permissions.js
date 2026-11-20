const { Router } = require("express");
const { route } = require("../utils/route");
const controller = require("../controllers/permission");
const {
    createGroupValidation,
    updateGroupValidation,
    setPermissionsValidation,
    addMemberValidation,
    setGroupsValidation,
    reorderGroupsValidation,
    setAccessPolicyValidation,
} = require("../validations/permission");

const app = Router();

const handle = (res, result) => {
    if (result?.code) return res.status(result.code).json(result);
    res.json(result);
};

app.get("/catalog", route({
    summary: "Permission catalog",
    description: "Returns the full catalog of system and organization permissions, grouped by category, that powers the permission editor UI.",
}), (req, res) => res.json(controller.getCatalog()));

app.get("/groups", route({
    summary: "List permission groups",
}), async (req, res) => handle(res, await controller.listGroups()));

app.put("/groups/order", route({
    summary: "Reorder permission groups",
    description: "Sets the priority order of custom roles. Roles earlier in the list win permission conflicts.",
    body: reorderGroupsValidation,
}), async (req, res) => {
    handle(res, await controller.reorderGroups(req.body.order));
});

app.post("/groups", route({
    summary: "Create permission group",
    body: createGroupValidation,
}), async (req, res) => {
    handle(res, await controller.createGroup(req.body));
});

app.get("/groups/:id", route({
    summary: "Get permission group",
}), async (req, res) => handle(res, await controller.getGroup(req.params.id)));

app.patch("/groups/:id", route({
    summary: "Update permission group",
    body: updateGroupValidation,
}), async (req, res) => {
    handle(res, await controller.updateGroup(req.params.id, req.body));
});

app.delete("/groups/:id", route({
    summary: "Delete permission group",
}), async (req, res) => handle(res, await controller.deleteGroup(req.params.id)));

app.put("/groups/:id/permissions", route({
    summary: "Set group permissions",
    body: setPermissionsValidation,
}), async (req, res) => {
    handle(res, await controller.setGroupPermissions(req.params.id, req.body.permissions, req.permissions));
});

app.post("/groups/:id/members", route({
    summary: "Add group member",
    body: addMemberValidation,
}), async (req, res) => {
    handle(res, await controller.addGroupMember(req.params.id, req.body.accountId, req.permissions));
});

app.delete("/groups/:id/members/:accountId", route({
    summary: "Remove group member",
}), async (req, res) =>
    handle(res, await controller.removeGroupMember(req.params.id, req.params.accountId, req.permissions)));

app.get("/users/:accountId", route({
    summary: "Get user permissions",
}), async (req, res) =>
    handle(res, await controller.getUserPermissions(req.params.accountId)));

app.put("/users/:accountId/groups", route({
    summary: "Set user groups",
    body: setGroupsValidation,
}), async (req, res) => {
    handle(res, await controller.setUserGroups(req.params.accountId, req.body.groupIds, req.permissions));
});

app.put("/users/:accountId/permissions", route({
    summary: "Set user permission overrides",
    body: setPermissionsValidation,
}), async (req, res) => {
    handle(res, await controller.setUserPermissions(req.params.accountId, req.body.permissions, req.permissions));
});

/**
 * GET /permissions/groups/{id}/access
 * @summary Get Group Access Policy
 * @description Returns the IP/engine blacklist/whitelist policy of a role. Applies to all members in addition to their personal policy.
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @return {object} 200 - The group's access policy
 */
app.get("/groups/:id/access", async (req, res) =>
    handle(res, await controller.getGroupAccessPolicy(req.params.id)));

/**
 * PUT /permissions/groups/{id}/access
 * @summary Set Group Access Policy
 * @description Sets the IP/engine blacklist/whitelist policy of a role.
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @param {object} request.body.required - { ipMode, ipRules, engineMode, engineIds }
 * @return {object} 200 - The group's updated access policy
 */
app.put("/groups/:id/access", async (req, res) => {
    if (validateSchema(res, setAccessPolicyValidation, req.body)) return;
    handle(res, await controller.setGroupAccessPolicy(req.params.id, req.body));
});

/**
 * GET /permissions/access-engines
 * @summary List Engines For Access Policy
 * @description Returns id/name of all engines for the per-user access policy editor.
 * @tags Permissions
 * @security BearerAuth
 * @return {array} 200 - Engines with id, name and isLocal flag
 */
app.get("/access-engines", async (req, res) =>
    handle(res, await controller.listAccessEngines()));

/**
 * GET /permissions/users/{accountId}/access
 * @summary Get User Access Policy
 * @description Returns the per-user IP/engine blacklist/whitelist policy.
 * @tags Permissions
 * @security BearerAuth
 * @param {string} accountId.path.required - Account id
 * @return {object} 200 - The user's access policy
 */
app.get("/users/:accountId/access", async (req, res) =>
    handle(res, await controller.getUserAccessPolicy(req.params.accountId)));

/**
 * PUT /permissions/users/{accountId}/access
 * @summary Set User Access Policy
 * @description Sets the per-user IP/engine blacklist/whitelist policy.
 * @tags Permissions
 * @security BearerAuth
 * @param {string} accountId.path.required - Account id
 * @param {object} request.body.required - { ipMode, ipRules, engineMode, engineIds }
 * @return {object} 200 - The user's updated access policy
 */
app.put("/users/:accountId/access", async (req, res) => {
    if (validateSchema(res, setAccessPolicyValidation, req.body)) return;
    handle(res, await controller.setUserAccessPolicy(req.params.accountId, req.body));
});

module.exports = app;
