const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("passkeys", {
    credentialId: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
    },
    credentialPublicKey: {
        type: Sequelize.TEXT,
        allowNull: false,
    },
    counter: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    credentialDeviceType: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    credentialBackedUp: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    transports: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "accounts", key: "id" },
        onDelete: "CASCADE",
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "Passkey",
    },
    createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
    },
}, { freezeTableName: true, updatedAt: false });
