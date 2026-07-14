const { genSalt, hash } = require("bcrypt");
const { Op } = require("sequelize");
const Account = require("../../models/Account");
const GroupMember = require("../../models/GroupMember");
const accountController = require("../../controllers/account");
const { getAdminGroupIds, getAdminAccountIds, isAccountAdmin, countAdmins } = require("../../utils/permission");
const { promptPassword, table, restartHint, throwOnControllerError, yn } = require("../utils");

const resolvePassword = (opts) => opts.password || promptPassword("Password");

const findByUsername = async (username) => {
    const account = await Account.findOne({ where: { username } });
    if (!account) throw new Error(`account '${username}' not found`);
    return account;
};

module.exports.list = async () => {
    const accounts = await Account.findAll({
        attributes: ["id", "username", "firstName", "lastName", "totpEnabled"],
        order: [["id", "ASC"]],
    });

    const adminAccountIds = await getAdminAccountIds();

    const rows = accounts.map((a) => ({
        id: a.id,
        username: a.username,
        name: `${a.firstName} ${a.lastName}`.trim(),
        role: adminAccountIds.has(a.id) ? "admin" : "user",
        totp: yn(a.totpEnabled),
    }));
    table(rows, ["id", "username", "name", "role", "totp"]);
};

module.exports.create = async (username, opts) => {
    if (await Account.findOne({ where: { username } })) throw new Error(`account '${username}' already exists`);
    const password = await hash(await resolvePassword(opts), await genSalt(10));
    const account = await Account.create({
        username,
        firstName: opts.firstName || username,
        lastName: opts.lastName || "",
        password,
    });

    if (opts.admin) {
        const [adminGroupId] = await getAdminGroupIds();
        if (adminGroupId) await GroupMember.create({ groupId: adminGroupId, accountId: account.id });
    }

    console.log(`created account ${account.username} (id=${account.id}, role=${opts.admin ? "admin" : "user"})`);
};

module.exports.resetPassword = async (username, opts) => {
    const account = await findByUsername(username);
    await throwOnControllerError(accountController.updatePassword(account.id, await resolvePassword(opts)));
    console.log(`password reset for ${username}`);
};

module.exports.promote = async (username) => {
    const account = await findByUsername(username);
    if (await isAccountAdmin(account.id)) { console.log(`${username} is already admin`); return; }

    const [adminGroupId] = await getAdminGroupIds();
    if (!adminGroupId) throw new Error("no administrator group exists");
    await GroupMember.findOrCreate({ where: { groupId: adminGroupId, accountId: account.id } });
    console.log(`promoted ${username} to admin`);
    restartHint("role changed");
};

module.exports.demote = async (username) => {
    const account = await findByUsername(username);
    if (!(await isAccountAdmin(account.id))) { console.log(`${username} is not an admin`); return; }

    if ((await countAdmins()) <= 1) throw new Error("cannot demote the last admin account");

    const adminGroupIds = await getAdminGroupIds();
    await GroupMember.destroy({ where: { groupId: { [Op.in]: adminGroupIds }, accountId: account.id } });
    console.log(`demoted ${username} to user`);
    restartHint("role changed");
};

module.exports.remove = async (username) => {
    const account = await findByUsername(username);
    await throwOnControllerError(accountController.deleteAccount(account.id));
    console.log(`deleted account ${username}`);
};
