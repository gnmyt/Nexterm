const { Router } = require("express");
const { listUsers, createAccount, deleteAccount, updatePassword } = require("../controllers/account");
const { validateSchema } = require("../utils/schema");
const { createUserValidation } = require("../validations/users");
const { createSession } = require("../controllers/session");
const { passwordChangeValidation } = require("../validations/account");
const { requirePermission } = require("../middlewares/permission");
const { Permission } = require("../permissions/registry");

const app = Router();

/**
 * GET /users/list
 * @summary List All Users
 * @description Retrieves a paginated list of all user accounts in the system including their permission groups. Supports search by username, first name, or last name. Requires the "users.view" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} search.query - Search term to filter users by username, first name, or last name
 * @param {number} limit.query - Maximum number of users to return (default: 50)
 * @param {number} offset.query - Number of users to skip for pagination (default: 0)
 * @return {object} 200 - Paginated list of user accounts with total count
 * @return {object} 403 - Insufficient permissions
 */
app.get("/list", async (req, res) => {
    const { search, limit, offset } = req.query;
    res.json(await listUsers({ search, limit, offset }));
});

/**
 * PUT /users
 * @summary Create User Account
 * @description Creates a new user account. Requires the "users.manage" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {CreateUser} request.body.required - User account details including username, password and name
 * @return {object} 200 - Account successfully created
 * @return {object} 403 - Insufficient permissions
 */
app.put("/", requirePermission(Permission.USERS_MANAGE), async (req, res) => {
    if (validateSchema(res, createUserValidation, req.body)) return;

    const account = await createAccount(req.body, false);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully created" });
});

/**
 * POST /users/{accountId}/login
 * @summary Impersonate User
 * @description Creates a session token for a specific user account, allowing administrators to impersonate users for support purposes. Requires the "users.impersonate" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @return {object} 200 - Session successfully created with token
 * @return {object} 404 - User account not found
 * @return {object} 403 - Insufficient permissions
 */
app.post("/:accountId/login", requirePermission(Permission.USERS_IMPERSONATE), async (req, res) => {
    const account = await createSession(req.params.accountId, req.headers["user-agent"]);
    if (account?.code) return res.json(account);

    res.json({ message: "Session got successfully created", token: account.token });
});

/**
 * DELETE /users/{accountId}
 * @summary Delete User Account
 * @description Permanently removes a user account and all associated data. This action cannot be undone. Requires the "users.manage" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account to delete
 * @return {object} 200 - Account successfully deleted
 * @return {object} 404 - User account not found
 * @return {object} 403 - Insufficient permissions
 */
app.delete("/:accountId", requirePermission(Permission.USERS_MANAGE), async (req, res) => {
    const account = await deleteAccount(req.params.accountId);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully deleted" });
});

/**
 * PATCH /users/{accountId}/password
 * @summary Update User Password
 * @description Updates a user's password. Requires the "users.manage" permission.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {PasswordChange} request.body.required - New password for the user account
 * @return {object} 200 - Password successfully updated
 * @return {object} 404 - User account not found
 * @return {object} 403 - Insufficient permissions
 */
app.patch("/:accountId/password", requirePermission(Permission.USERS_MANAGE), async (req, res) => {
    if (validateSchema(res, passwordChangeValidation, req.body)) return;

    const account = await updatePassword(req.params.accountId, req.body.password);
    if (account?.code) return res.json(account);

    res.json({ message: "Password got successfully updated" });
});

module.exports = app;
