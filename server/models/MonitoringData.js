const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("monitoring_data", {
    entryId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "entries", key: "id" },
        onDelete: "CASCADE",
    },
    integrationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "integrations", key: "id" },
        onDelete: "CASCADE",
    },
    timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    cpuUsage: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    memoryUsage: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    uptime: {
        type: Sequelize.BIGINT,
        allowNull: true,
    },
    loadAverage: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    processes: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
}, {
    freezeTableName: true,
    timestamps: false,
    indexes: [
        { fields: ["entryId", "timestamp"] },
        { fields: ["integrationId", "timestamp"] },
    ],
    hooks: {
        afterFind: (records) => {
            const parse = (record) => {
                if (record?.loadAverage && typeof record.loadAverage === "string") {
                    try { record.loadAverage = JSON.parse(record.loadAverage); } catch {}
                }
            };
            Array.isArray(records) ? records.forEach(parse) : parse(records);
        },
    },
});
