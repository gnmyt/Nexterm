const { genSalt, hash } = require("bcrypt");
const Account = require("../models/Account");
const Folder = require("../models/Folder");
const Identity = require("../models/Identity");
const Session = require("../models/Session");
const logger = require("../utils/logger");

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
    const newAccount = await Account.create({ ...configuration, password, role: firstTimeSetup ? "admin" : "user" });

    logger.system(`Account created`, { accountId: newAccount.id, username: newAccount.username, role: newAccount.role, firstTimeSetup });
};

module.exports.deleteAccount = async (id) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    if (await Account.count({ where: { role: "admin" } }) === 1 && account.role === "admin")
        return { code: 106, message: "You cannot delete the last admin account" };

    await Folder.destroy({ where: { accountId: id } });
    await Identity.destroy({ where: { accountId: id } });
    await Session.destroy({ where: { accountId: id } });

    await Account.destroy({ where: { id } });

    logger.system(`Account deleted`, { accountId: id, username: account.username });
}

module.exports.updateName = async (id, configuration) => {
    const account = await Account.findByPk(id);

    const {firstName, lastName} = configuration;

    if (firstName === null && lastName === null)
        return { code: 105, message: "You must provide either a first name or a last name" };

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    await Account.update({ firstName, lastName }, { where: { id } });
}

module.exports.updatePassword = async (id, password) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);

    await Account.update({ password: hashedPassword }, { where: { id } });
}

module.exports.updateRole = async (id, role) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    if (role === account.role)
        return { code: 107, message: "The provided role is the same as the current role" };

    if (role !== "admin" && role !== "user")
        return { code: 108, message: "The provided role is invalid" };

    await Account.update({ role }, { where: { id } });

    logger.system(`Account role updated`, { accountId: id, username: account.username, oldRole: account.role, newRole: role });
}

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

module.exports.updatePreferences = async (id, payload) => {
    const account = await Account.findByPk(id);
    if (account === null) return { code: 102, message: "The provided account does not exist" };

    const current = account.preferences || {};

    let merged = {};
    try {
        merged = current && typeof current === 'object' ? JSON.parse(JSON.stringify(current)) : {};
    } catch (e) {
        merged = {};
    }

    const allowedGroups = ["appearance", "terminal"];

    try {
        if (!payload) {
            // nothing to do
        } else if (payload.group && payload.values && typeof payload.values === 'object' && payload.values !== null && !Array.isArray(payload.values)) {
            const group = String(payload.group);
            if (allowedGroups.includes(group)) {
                merged[group] = { ...(current[group] || {}), ...payload.values };
            }
        } else {
            // accept explicit group keys only to avoid iterating arbitrary objects
            if (payload.appearance && typeof payload.appearance === 'object' && payload.appearance !== null && !Array.isArray(payload.appearance)) {
                merged.appearance = { ...(current.appearance || {}), ...payload.appearance };
            }
            if (payload.terminal && typeof payload.terminal === 'object' && payload.terminal !== null && !Array.isArray(payload.terminal)) {
                merged.terminal = { ...(current.terminal || {}), ...payload.terminal };
            }
        }
    } catch (err) {
        const logger = require("../utils/logger");
        logger.error("updatePreferences failed to merge payload", { error: err?.message || String(err), stack: err?.stack });
        return { code: 400, message: "Invalid preferences payload" };
    }

    await Account.update({ preferences: merged }, { where: { id } });
};

module.exports.getFTSStatus = async () => {
    return await Account.count() === 0;
}

module.exports.listUsers = async () => {
    return await Account.findAll({ attributes: { exclude: ["password", "totpSecret"] } });
}