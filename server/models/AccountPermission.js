const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("account_permissions", {
    accountId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
    },
    permission: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
    },
    value: {
        type: Sequelize.ENUM("allow", "deny"),
        allowNull: false,
        defaultValue: "allow",
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });
