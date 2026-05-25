const { genSalt, hash } = require("bcrypt");
const Account = require("../../models/Account");
const accountController = require("../../controllers/account");
const { promptPassword, table, restartHint, throwOnControllerError, yn } = require("../utils");

const resolvePassword = (opts) => opts.password || promptPassword("Password");

const findByUsername = async (username) => {
    const account = await Account.findOne({ where: { username } });
    if (!account) throw new Error(`account '${username}' not found`);
    return account;
};

module.exports.list = async () => {
    const accounts = await Account.findAll({
        attributes: ["id", "username", "firstName", "lastName", "role", "totpEnabled"],
        order: [["id", "ASC"]],
    });
    table(accounts.map((a) => ({
        id: a.id,
        username: a.username,
        name: `${a.firstName} ${a.lastName}`.trim(),
        role: a.role,
        totp: yn(a.totpEnabled),
    })), ["id", "username", "name", "role", "totp"]);
};

module.exports.create = async (username, opts) => {
    if (await Account.findOne({ where: { username } })) throw new Error(`account '${username}' already exists`);
    const password = await hash(await resolvePassword(opts), await genSalt(10));
    const account = await Account.create({
        username,
        firstName: opts.firstName || username,
        lastName: opts.lastName || "",
        password,
        role: opts.admin ? "admin" : "user",
    });
    console.log(`created account ${account.username} (id=${account.id}, role=${account.role})`);
};

module.exports.resetPassword = async (username, opts) => {
    const account = await findByUsername(username);
    await throwOnControllerError(accountController.updatePassword(account.id, await resolvePassword(opts)));
    console.log(`password reset for ${username}`);
};

const setRole = async (username, role, alreadyMsg, lastAdminGuard) => {
    const account = await findByUsername(username);
    if (account.role === role) { console.log(alreadyMsg); return; }
    if (lastAdminGuard && await Account.count({ where: { role: "admin" } }) === 1)
        throw new Error("cannot demote the last admin account");
    await throwOnControllerError(accountController.updateRole(account.id, role));
    console.log(`${role === "admin" ? "promoted" : "demoted"} ${username} to ${role}`);
    restartHint("role changed");
};

module.exports.promote = (username) => setRole(username, "admin", `${username} is already admin`, false);
module.exports.demote = (username) => setRole(username, "user", `${username} is not an admin`, true);

module.exports.remove = async (username) => {
    const account = await findByUsername(username);
    await throwOnControllerError(accountController.deleteAccount(account.id));
    console.log(`deleted account ${username}`);
};
