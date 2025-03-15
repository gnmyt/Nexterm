const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("folders", {
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
    parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
    }
}, { freezeTableName: true, createdAt: false, updatedAt: false });