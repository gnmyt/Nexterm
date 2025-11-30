const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("sources", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    lastSyncStatus: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    snippetCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    scriptCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, { freezeTableName: true, createdAt: true, updatedAt: true });
