const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("servers", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    folderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    icon: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    protocol: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    ip: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    port: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    identities: {
        type: Sequelize.JSON,
        defaultValue: [],
    },
    config: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    monitoringEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });