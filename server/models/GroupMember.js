const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("group_members", {
    groupId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });
