const Sequelize = require("sequelize");
const db = require("../utils/database");
const logger = require("../utils/logger");

module.exports = db.define("monitoring_data", {
    entryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: "entries",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
    },
    cpuUsage: {
        type: Sequelize.FLOAT,
        allowNull: true,
    },
    memoryUsage: {
        type: Sequelize.FLOAT,
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
    uptime: {
        type: Sequelize.BIGINT,
        allowNull: true,
    },
    loadAverage: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    network: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    processes: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    osInfo: {
        type: Sequelize.JSON,
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
        {
            fields: ["entryId", "timestamp"],
        },
    ],
    hooks: {
        afterFind: (entries) => {
            const parseJsonFields = (entry) => {
                if (entry) {
                    const jsonFields = ['disk', 'loadAverage', 'network', 'processes', 'osInfo'];
                    jsonFields.forEach(field => {
                        if (entry[field] && typeof entry[field] === 'string') {
                            try {
                                entry[field] = JSON.parse(entry[field]);
                            } catch (e) {
                                logger.error(`Failed to parse monitoring field`, { field, error: e.message });
                            }
                        }
                    });
                }
            };

            if (Array.isArray(entries)) {
                entries.forEach(parseJsonFields);
            } else if (entries) {
                parseJsonFields(entries);
            }
        },
    },
});
