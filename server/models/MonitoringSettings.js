const { INTEGER, BOOLEAN, DATE, NOW } = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("monitoring_settings", {
    id: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    statusCheckerEnabled: {
        type: BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
    statusInterval: {
        type: INTEGER,
        defaultValue: 30,
        allowNull: false,
    },
    monitoringEnabled: {
        type: BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
    monitoringInterval: {
        type: INTEGER,
        defaultValue: 60,
        allowNull: false,
    },
    dataRetentionHours: {
        type: INTEGER,
        defaultValue: 24,
        allowNull: false,
    },
    connectionTimeout: {
        type: INTEGER,
        defaultValue: 30,
        allowNull: false,
    },
    batchSize: {
        type: INTEGER,
        defaultValue: 10,
        allowNull: false,
    },
    createdAt: {
        type: DATE,
        defaultValue: NOW,
    },
    updatedAt: {
        type: DATE,
        defaultValue: NOW,
    },
});