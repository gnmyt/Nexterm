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
    totpSecret: {
        type: Sequelize.STRING,
        defaultValue: () => {
            return speakeasy.generateSecret({ name: "Nexterm" }).base32;
        },
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });