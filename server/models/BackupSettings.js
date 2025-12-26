const { INTEGER, BOOLEAN, TEXT, DATE, NOW } = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("backup_settings", {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    providers: { type: TEXT, defaultValue: "[]", allowNull: false },
    scheduleInterval: { type: INTEGER, defaultValue: 0, allowNull: false },
    retention: { type: INTEGER, defaultValue: 5, allowNull: false },
    includeDatabase: { type: BOOLEAN, defaultValue: true, allowNull: false },
    includeRecordings: { type: BOOLEAN, defaultValue: true, allowNull: false },
    includeLogs: { type: BOOLEAN, defaultValue: false, allowNull: false },
    createdAt: { type: DATE, defaultValue: NOW },
    updatedAt: { type: DATE, defaultValue: NOW },
}, {
    freezeTableName: true,
    hooks: {
        afterFind: (result) => {
            const parse = (r) => {
                if (r && r.providers && typeof r.providers === "string") {
                    try {
                        r.providers = JSON.parse(r.providers);
                    } catch {
                        r.providers = [];
                    }
                }
            };
            Array.isArray(result) ? result.forEach(parse) : parse(result);
        },
    },
});
