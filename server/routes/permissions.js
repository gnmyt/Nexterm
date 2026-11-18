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

module.exports = app;
