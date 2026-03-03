const { INTEGER, BOOLEAN, DATE, NOW } = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("backup_settings", {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    scheduleInterval: { type: INTEGER, defaultValue: 0, allowNull: false },
    retention: { type: INTEGER, defaultValue: 5, allowNull: false },
    includeDatabase: { type: BOOLEAN, defaultValue: true, allowNull: false },
    includeRecordings: { type: BOOLEAN, defaultValue: true, allowNull: false },
    includeLogs: { type: BOOLEAN, defaultValue: false, allowNull: false },
    createdAt: { type: DATE, defaultValue: NOW },
    updatedAt: { type: DATE, defaultValue: NOW },
}, {
    freezeTableName: true,
});
