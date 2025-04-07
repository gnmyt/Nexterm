const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("snippets", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    command: {
        type: Sequelize.TEXT,
        allowNull: false,
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
    }
}, { freezeTableName: true, createdAt: false, updatedAt: false });