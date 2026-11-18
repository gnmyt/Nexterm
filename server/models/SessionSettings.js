const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("session_settings", {
    idleTimeoutDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 14,
    },
    maxLifetimeDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 90,
    },
}, { freezeTableName: true, timestamps: true });
