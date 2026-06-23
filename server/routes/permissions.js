const { Router } = require("express");
const controller = require("../controllers/permission");
const { validateSchema } = require("../utils/schema");
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

/**
 * GET /permissions/catalog
 * @summary Permission Catalog
 * @description Returns the full catalog of system and organization permissions, grouped by category, that powers the permission editor UI.
 * @tags Permissions
 * @security BearerAuth
 * @return {object} 200 - System and organization permission definitions
 */
app.get("/catalog", (req, res) => res.json(controller.getCatalog()));

/**
 * GET /permissions/groups
 * @summary List Permission Groups
 * @tags Permissions
 * @security BearerAuth
 * @return {object} 200 - All permission groups with their permissions and member counts
 */
app.get("/groups", async (req, res) => handle(res, await controller.listGroups()));

/**
 * POST /permissions/groups
 * @summary Create Permission Group
 * @tags Permissions
 * @security BearerAuth
 * @param {object} request.body.required - name and optional color
 * @return {object} 200 - The created group
 */
/**
 * PUT /permissions/groups/order
 * @summary Reorder Permission Groups
 * @description Sets the priority order of custom roles. Roles earlier in the list win permission conflicts.
 * @tags Permissions
 * @security BearerAuth
 * @param {object} request.body.required - { order: number[] } - custom role ids, highest priority first
 * @return {object} 200 - All permission groups in their new order
 */
app.put("/groups/order", async (req, res) => {
    if (validateSchema(res, reorderGroupsValidation, req.body)) return;
    handle(res, await controller.reorderGroups(req.body.order));
});

app.post("/groups", async (req, res) => {
    if (validateSchema(res, createGroupValidation, req.body)) return;
    handle(res, await controller.createGroup(req.body));
});

/**
 * GET /permissions/groups/{id}
 * @summary Get Permission Group
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @return {object} 200 - Group with permissions and members
 */
app.get("/groups/:id", async (req, res) => handle(res, await controller.getGroup(req.params.id)));

/**
 * PATCH /permissions/groups/{id}
 * @summary Update Permission Group
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @return {object} 200 - The updated group
 */
app.patch("/groups/:id", async (req, res) => {
    if (validateSchema(res, updateGroupValidation, req.body)) return;
    handle(res, await controller.updateGroup(req.params.id, req.body));
});

/**
 * DELETE /permissions/groups/{id}
 * @summary Delete Permission Group
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @return {object} 200 - Success
 */
app.delete("/groups/:id", async (req, res) => handle(res, await controller.deleteGroup(req.params.id)));

/**
 * PUT /permissions/groups/{id}/permissions
 * @summary Set Group Permissions
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @param {object} request.body.required - { permissions: { permissionId: "allow"|"deny"|"neutral" } }
 * @return {object} 200 - The updated group
 */
app.put("/groups/:id/permissions", async (req, res) => {
    if (validateSchema(res, setPermissionsValidation, req.body)) return;
    handle(res, await controller.setGroupPermissions(req.params.id, req.body.permissions));
});

/**
 * POST /permissions/groups/{id}/members
 * @summary Add Group Member
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @param {object} request.body.required - { accountId }
 * @return {object} 200 - Success
 */
app.post("/groups/:id/members", async (req, res) => {
    if (validateSchema(res, addMemberValidation, req.body)) return;
    handle(res, await controller.addGroupMember(req.params.id, req.body.accountId));
});

/**
 * DELETE /permissions/groups/{id}/members/{accountId}
 * @summary Remove Group Member
 * @tags Permissions
 * @security BearerAuth
 * @param {string} id.path.required - Group id
 * @param {string} accountId.path.required - Account id
 * @return {object} 200 - Success
 */
app.delete("/groups/:id/members/:accountId", async (req, res) =>
    handle(res, await controller.removeGroupMember(req.params.id, req.params.accountId)));

/**
 * GET /permissions/users/{accountId}
 * @summary Get User Permissions
 * @tags Permissions
 * @security BearerAuth
 * @param {string} accountId.path.required - Account id
 * @return {object} 200 - The user's groups, overrides and effective permissions
 */
app.get("/users/:accountId", async (req, res) =>
    handle(res, await controller.getUserPermissions(req.params.accountId)));

/**
 * PUT /permissions/users/{accountId}/groups
 * @summary Set User Groups
 * @tags Permissions
 * @security BearerAuth
 * @param {string} accountId.path.required - Account id
 * @param {object} request.body.required - { groupIds: number[] }
 * @return {object} 200 - The user's updated permissions
 */
app.put("/users/:accountId/groups", async (req, res) => {
    if (validateSchema(res, setGroupsValidation, req.body)) return;
    handle(res, await controller.setUserGroups(req.params.accountId, req.body.groupIds));
});

/**
 * PUT /permissions/users/{accountId}/permissions
 * @summary Set User Permission Overrides
 * @tags Permissions
 * @security BearerAuth
 * @param {string} accountId.path.required - Account id
 * @param {object} request.body.required - { permissions: { permissionId: "allow"|"deny"|"neutral" } }
 * @return {object} 200 - The user's updated permissions
 */
app.put("/users/:accountId/permissions", async (req, res) => {
    if (validateSchema(res, setPermissionsValidation, req.body)) return;
    handle(res, await controller.setUserPermissions(req.params.accountId, req.body.permissions));
});

module.exports = app;
