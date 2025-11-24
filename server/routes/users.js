const { Router } = require("express");
const { listUsers, createAccount, deleteAccount, updatePassword, updateRole } = require("../controllers/account");
const { validateSchema } = require("../utils/schema");
const { createUserValidation, updateRoleValidation } = require("../validations/users");
const { createSession } = require("../controllers/session");
const { passwordChangeValidation } = require("../validations/account");

const app = Router();

/**
 * GET /users/list
 * @summary List All Users (Admin)
 * @description Retrieves a list of all user accounts in the system including their roles and status. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @return {array} 200 - List of all user accounts
 * @return {object} 403 - Admin access required
 */
app.get("/list", async (req, res) => {
    res.json(await listUsers());
});

/**
 * PUT /users
 * @summary Create User Account (Admin)
 * @description Creates a new user account with specified role and credentials. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {CreateUser} request.body.required - User account details including username, password, name, and role
 * @return {object} 200 - Account successfully created
 * @return {object} 403 - Admin access required
 */
app.put("/", async (req, res) => {
    if (validateSchema(res, createUserValidation, req.body)) return;

    const account = await createAccount(req.body, false);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully created" });
});

/**
 * POST /users/{accountId}/login
 * @summary Create User Session (Admin)
 * @description Creates a session token for a specific user account, allowing administrators to impersonate users for support purposes. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @return {object} 200 - Session successfully created with token
 * @return {object} 404 - User account not found
 * @return {object} 403 - Admin access required
 */
app.post("/:accountId/login", async (req, res) => {
    const account = await createSession(req.params.accountId, req.headers["user-agent"]);
    if (account?.code) return res.json(account);

    res.json({ message: "Session got successfully created", token: account.token });
});

/**
 * DELETE /users/{accountId}
 * @summary Delete User Account (Admin)
 * @description Permanently removes a user account and all associated data. This action cannot be undone. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account to delete
 * @return {object} 200 - Account successfully deleted
 * @return {object} 404 - User account not found
 * @return {object} 403 - Admin access required
 */
app.delete("/:accountId", async (req, res) => {
    const account = await deleteAccount(req.params.accountId);
    if (account?.code) return res.json(account);

    res.json({ message: "Account got successfully deleted" });
});

/**
 * PATCH /users/{accountId}/password
 * @summary Update User Password (Admin)
 * @description Updates a user's password. Admin access required to modify other users' passwords.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {PasswordChange} request.body.required - New password for the user account
 * @return {object} 200 - Password successfully updated
 * @return {object} 404 - User account not found
 * @return {object} 403 - Admin access required
 */
app.patch("/:accountId/password", async (req, res) => {
    if (validateSchema(res, passwordChangeValidation, req.body)) return;

    const account = await updatePassword(req.params.accountId, req.body.password);
    if (account?.code) return res.json(account);

    res.json({ message: "Password got successfully updated" });
});

/**
 * PATCH /users/{accountId}/role
 * @summary Update User Role (Admin)
 * @description Updates a user's role in the system (e.g., admin, user). Administrators cannot change their own role. Admin access required.
 * @tags Users
 * @produces application/json
 * @security BearerAuth
 * @param {string} accountId.path.required - The unique identifier of the user account
 * @param {UpdateRole} request.body.required - New role for the user account
 * @return {object} 200 - Role successfully updated
 * @return {object} 400 - Cannot change your own role or invalid account ID
 * @return {object} 403 - Admin access required
 */
app.patch("/:accountId/role", async (req, res) => {
    try {
        if (req.user.id === parseInt(req.params.accountId))
            return res.status(400).json({ code: 107, message: "You cannot change your own role" });

        if (validateSchema(res, updateRoleValidation, req.body)) return;

        const account = await updateRole(req.params.accountId, req.body.role);
        if (account?.code) return res.json(account);

        res.json({ message: "Role got successfully updated" });
    } catch (error) {
        res.status(400).json({ code: 109, message: "You need to provide a correct id"});
    }
});

module.exports = app;