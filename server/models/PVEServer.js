const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("pve_servers", {
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
    folderId: {
        type: Sequelize.INTEGER,
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
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    online: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    resources: {
        type: Sequelize.JSON,
        defaultValue: [],
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });