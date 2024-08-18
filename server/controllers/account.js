const { genSalt, hash } = require("bcrypt");
const Account = require("../models/Account");

module.exports.createAccount = async configuration => {
    if (await Account.count() > 0)
        return { code: 104, message: "First time setup is already completed" };

    const account = await Account.findOne({ where: { username: configuration.username } });

    if (account !== null)
        return { code: 101, message: "This account already exists" };

    // Hash the password
    const salt = await genSalt(10);
    const password = await hash(configuration.password, salt);

    // Create the account
    await Account.create({ ...configuration, password });
};

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

module.exports.updateTOTP = async (id, status) => {
    const account = await Account.findByPk(id);

    if (account === null)
        return { code: 102, message: "The provided account does not exist" };

    if (account.totpEnabled === status)
        return { code: 103, message: `TOTP is already ${status ? "enabled" : "disabled"} on your account` };

    await Account.update({ totpEnabled: status }, { where: { id } });
};