const Sequelize = require("sequelize");
const db = require("../utils/database");
const speakeasy = require("speakeasy");

module.exports = db.define("accounts", {
    firstName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    totpEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    role: {
        type: Sequelize.STRING,
        defaultValue: "user",
    },
    totpSecret: {
        type: Sequelize.STRING,
        defaultValue: () => {
            return speakeasy.generateSecret({ name: "Nexterm" }).base32;
        },
    },
    sessionSync: {
        type: Sequelize.STRING,
        defaultValue: "same_browser",
    },
    currentChallenge: {
        type: Sequelize.STRING,
        allowNull: true,
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });