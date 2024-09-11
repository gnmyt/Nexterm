const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("app_sources", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
    },
    url: {
        type: Sequelize.STRING,
        allowNull: false,
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });