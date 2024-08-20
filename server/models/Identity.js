const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("identities", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    sshKey: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    passphrase: {
        type: Sequelize.STRING,
        allowNull: true,
    }
}, { freezeTableName: true, createdAt: false, updatedAt: false });