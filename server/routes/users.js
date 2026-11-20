const { Router } = require("express");
const { route } = require("../utils/route");
const { validateSchema } = require("../utils/schema");
const { listUsers, createAccount, deleteAccount, updatePassword, updateExternalLink } = require("../controllers/account");
const Joi = require("joi");
const logger = require("../utils/logger");
const { createUserValidation } = require("../validations/users");
const { createSession } = require("../controllers/session");
const { passwordChangeValidation } = require("../validations/account");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");
const permissionController = require("../controllers/permission");
const { setAccessPolicyValidation } = require("../validations/permission");

const app = Router();

app.get("/list", route({
    summary: "List all users",
    description: "Retrieves a paginated list of all user accounts in the system including their permission groups. Supports search by username, first name, or last name.",
    query: Joi.object({
        search: Joi.string().allow("").description("Search term to filter users by username, first name, or last name"),
        limit: Joi.number().description("Maximum number of users to return (default: 50)"),
        offset: Joi.number().description("Number of users to skip for pagination (default: 0)"),
    }),
}), async (req, res) => {
    const { search, limit, offset } = req.query;
    res.json(await listUsers({ search, limit, offset }));
});

app.put("/", requirePermission(Permission.USERS_MANAGE), route({
    summary: "Create user account",
    description: "Creates a new user account.",
    body: createUserValidation,
}), async (req, res) => {
    const account = await createAccount(req.body, false);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully created" });
});

app.post("/:accountId/login", requirePermission(Permission.USERS_IMPERSONATE), route({
    summary: "Impersonate user",
    description: "Creates a session token for a specific user account, allowing administrators to impersonate users for support purposes.",
}), async (req, res) => {
    const account = await createSession(req.params.accountId, req.headers["user-agent"]);
    if (account?.code) return res.json(account);

    res.json({ message: "Session got successfully created", token: account.token });
});

app.delete("/:accountId", requirePermission(Permission.USERS_MANAGE), route({
    summary: "Delete user account",
    description: "Permanently removes a user account and all associated data. This action cannot be undone.",
}), async (req, res) => {
    const account = await deleteAccount(req.params.accountId);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully deleted" });
});

app.patch("/:accountId/password", requirePermission(Permission.USERS_MANAGE), route({
    summary: "Update user password",
    description: "Updates a user's password and signs the user out everywhere.",
    body: passwordChangeValidation,
}), async (req, res) => {
    const ownAccount = Number(req.params.accountId) === req.user.id;
    const account = await updatePassword(req.params.accountId, req.body.password, ownAccount ? req.session?.id : null);
    if (account?.code) return res.json(account);

    res.json({ message: "Password got successfully updated" });
});

/**
 * GET /users/access-engines
 * @summary List Engines For Access Policy
 * @description Returns id/name of all engines for the per-user access policy editor.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - Engines with id, name and isLocal flag
 */
app.get("/access-engines", async (req, res) => {
    const result = await permissionController.listAccessEngines();
    if (result?.code) return res.json(result);
    res.json(result);
});

/**
 * GET /users/{accountId}/access
 * @summary Get User Access Policy
 * @description Returns the per-user IP/engine blacklist/whitelist policy. Requires the "users.manage" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @return {object} 200 - The user's access policy
 */
app.get("/:accountId/access", requirePermission(Permission.USERS_MANAGE), async (req, res) => {
    const result = await permissionController.getUserAccessPolicy(req.params.accountId);
    if (result?.code) return res.json(result);
    res.json(result);
});

/**
 * PUT /users/{accountId}/access
 * @summary Set User Access Policy
 * @description Sets the per-user IP/engine blacklist/whitelist policy. Requires the "users.manage" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {object} request.body.required - { ipMode, ipRules, engineMode, engineIds }
 * @return {object} 200 - The user's updated access policy
 */
app.put("/:accountId/access", requirePermission(Permission.USERS_MANAGE), async (req, res) => {
    if (validateSchema(res, setAccessPolicyValidation, req.body)) return;
    const result = await permissionController.setUserAccessPolicy(req.params.accountId, req.body);
    if (result?.code) return res.json(result);
    res.json(result);
});

app.patch("/:accountId/external-link", requirePermission(Permission.USERS_MANAGE), route({
    summary: "Update external sign-in link",
    description: "Allows the next OIDC or LDAP login with this username to link to the account, or removes the existing link.",
    body: Joi.object({ allow: Joi.boolean().required() }),
}), async (req, res) => {
    const result = await updateExternalLink(req.params.accountId, req.body);
    if (result?.code) return res.json(result);

    logger.system(req.body.allow ? "External sign-in link allowed" : "External sign-in link removed",
        { accountId: Number(req.params.accountId), by: req.user.id });
    res.json({ message: req.body.allow ? "Linking allowed on next sign-in" : "Sign-in link removed" });
});

module.exports = app;
