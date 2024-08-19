const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("folders", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });