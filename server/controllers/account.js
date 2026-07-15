const { genSalt, hash } = require("bcrypt");
const { Op } = require("sequelize");
const Account = require("../models/Account");
const OIDCProvider = require("../models/OIDCProvider");
const Folder = require("../models/Folder");
const Identity = require("../models/Identity");
const Session = require("../models/Session");
const OrganizationMember = require("../models/OrganizationMember");
const OrganizationMemberPermission = require("../models/OrganizationMemberPermission");
const PermissionGroup = require("../models/PermissionGroup");
const GroupMember = require("../models/GroupMember");
const AccountPermission = require("../models/AccountPermission");
const { isAccountAdmin, countAdmins } = require("../utils/permission");
const logger = require("../utils/logger");
const SessionManager = require("../lib/SessionManager");
const stateBroadcaster = require("../lib/StateBroadcaster");

module.exports.createAccount = async (configuration, firstTimeSetup = true) => {
    if (await Account.count() > 0 && firstTimeSetup)
        return { code: 104, message: "First time setup is already completed" };

    const account = await Account.findOne({ where: { username: configuration.username } });

    if (account !== null)
        return { code: 101, message: "This account already exists" };

    // Hash the password
    const salt = await genSalt(10);
    const password = await hash(configuration.password, salt);

    // Create the account
    const newAccount = await Account.create({ ...configuration, password });

    if (firstTimeSetup) {
        const adminGroup = await PermissionGroup.findOne({ where: { isAdmin: true } });
        if (adminGroup) await GroupMember.create({ groupId: adminGroup.id, accountId: newAccount.id });
    }

    logger.system(`Account created`, {
        accountId: newAccount.id,
        username: newAccount.username,
        firstTimeSetup,
    });
};

module.exports.isRegistrationEnabled = async () => {
    const internalProvider = await OIDCProvider.findOne({ where: { isInternal: true } });
    return !!(internalProvider?.enabled && internalProvider.allowRegistration);
};

module.exports.selfRegister = async (configuration) => {
    if (!await module.exports.isRegistrationEnabled())
        return { code: 107, message: "Self-registration is not enabled" };

    return module.exports.createAccount(configuration, false);
};

module.exports.deleteAccount = async (id) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    if (await isAccountAdmin(id) && (await countAdmins()) <= 1)
        return { code: 106, message: "You cannot delete the last administrator account" };

    stateBroadcaster.forceLogout(id);
    await SessionManager.removeAllByAccountId(id);

    await Folder.destroy({ where: { accountId: id } });
    await Identity.destroy({ where: { accountId: id } });
    await Session.destroy({ where: { accountId: id } });
    await OrganizationMember.destroy({ where: { accountId: id } });
    await GroupMember.destroy({ where: { accountId: id } });
    await AccountPermission.destroy({ where: { accountId: id } });
    await OrganizationMemberPermission.destroy({ where: { accountId: id } });

    await Account.destroy({ where: { id } });

    logger.system(`Account deleted`, { accountId: id, username: account.username });
};

module.exports.updateName = async (id, configuration) => {
    const account = await Account.findByPk(id);

    const { firstName, lastName } = configuration;

    if (firstName === null && lastName === null)
        return { code: 105, message: "You must provide either a first name or a last name" };

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    await Account.update({ firstName, lastName }, { where: { id } });
};

module.exports.updatePassword = async (id, password) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);

    await Account.update({ password: hashedPassword }, { where: { id } });
};

module.exports.updateTOTP = async (id, status) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    if (account.totpEnabled === status)
        return { code: 103, message: `TOTP is already ${status ? "enabled" : "disabled"} on your account` };

    await Account.update({ totpEnabled: status }, { where: { id } });
};

module.exports.updateSessionSync = async (id, sessionSync) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    await Account.update({ sessionSync }, { where: { id } });
};

const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
};

module.exports.updatePreferences = async (id, preferences) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    const currentPreferences = account.preferences || {};
    const mergedPreferences = deepMerge(currentPreferences, preferences);

    await Account.update({ preferences: mergedPreferences }, { where: { id } });

    return mergedPreferences;
};

module.exports.getFTSStatus = async () => {
    return await Account.count() === 0;
};

module.exports.searchUsers = async (search = "") => {
    if (!search || search.trim().length < 3) {
        return { users: [] };
    }

    const searchTerm = `%${search.trim()}%`;
    const users = await Account.findAll({
        where: {
            [Op.or]: [
                { username: { [Op.like]: searchTerm } },
                { firstName: { [Op.like]: searchTerm } },
                { lastName: { [Op.like]: searchTerm } },
            ],
        },
        attributes: ["id", "username", "firstName", "lastName"],
        limit: 5,
        order: [["username", "ASC"]],
    });

    return { users };
};

const attachGroups = async (users) => {
    if (!users.length) return users;

    const userIds = users.map((u) => u.id);
    const [memberships, groups] = await Promise.all([
        GroupMember.findAll({ where: { accountId: { [Op.in]: userIds } } }),
        PermissionGroup.findAll({ order: [["sortOrder", "ASC"], ["id", "ASC"]] }),
    ]);

    const groupById = new Map(groups.map((g) => [g.id, g]));
    const defaultGroups = groups.filter((g) => g.isDefault);
    const toView = (g) => ({ id: g.id, name: g.name, color: g.color, isAdmin: g.isAdmin, isDefault: g.isDefault });

    return users.map((user) => {
        const assigned = memberships
            .filter((m) => m.accountId === user.id)
            .map((m) => groupById.get(m.groupId))
            .filter(Boolean);

        const all = [...assigned];
        for (const dg of defaultGroups) if (!all.some((g) => g.id === dg.id)) all.push(dg);
        all.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

        return { ...user, groups: all.map(toView), isAdmin: all.some((g) => g.isAdmin) };
    });
};
module.exports.attachGroups = attachGroups;

module.exports.listUsers = async (options = {}) => {
    const { search = "", limit = 50, offset = 0 } = options;

    const whereClause = {};

    if (search) {
        const searchTerm = `%${search}%`;
        whereClause[Op.or] = [
            { username: { [Op.like]: searchTerm } },
            { firstName: { [Op.like]: searchTerm } },
            { lastName: { [Op.like]: searchTerm } },
        ];
    }

    const [users, total] = await Promise.all([
        Account.findAll({
            where: whereClause,
            attributes: { exclude: ["password", "totpSecret", "preferences", "sessionSync"] },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [["id", "DESC"]],
        }),
        Account.count({ where: whereClause }),
    ]);

    return { users: await attachGroups(users), total };
};