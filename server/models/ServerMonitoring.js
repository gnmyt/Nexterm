const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("server_monitoring", {
    serverId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
    },
    status: {
        type: Sequelize.STRING,
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
    diskUsage: {
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
    networkInterfaces: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    processes: {
        type: Sequelize.INTEGER,
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
    createdAt: false,
    updatedAt: false,
    indexes: [
        {
            fields: ["serverId", "timestamp"],
        },
    ],
});
