const Sequelize = require("sequelize");
const db = require("../utils/database");
const logger = require("../utils/logger");

module.exports = db.define("monitoring_snapshot", {
    entryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "entries", key: "id" },
        onDelete: "CASCADE",
    },
    updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    memoryTotal: {
        type: Sequelize.BIGINT,
        allowNull: true,
    },
    disk: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    network: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    processList: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    osInfo: {
        type: Sequelize.JSON,
        allowNull: true,
    },
}, {
    freezeTableName: true,
    timestamps: false,
    hooks: {
        afterFind: (records) => {
            const parseJsonFields = (record) => {
                if (!record) return;
                ["disk", "network", "processList", "osInfo"].forEach(field => {
                    if (record[field] && typeof record[field] === "string") {
                        try { record[field] = JSON.parse(record[field]); }
                        catch (e) { logger.error("Failed to parse snapshot field", { field, error: e.message }); }
                    }
                });
            };
            Array.isArray(records) ? records.forEach(parseJsonFields) : parseJsonFields(records);
        },
    },
});
