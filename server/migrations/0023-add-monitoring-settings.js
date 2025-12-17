const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const { INTEGER, BOOLEAN, DATE, NOW } = Sequelize;
        const col = (type, defaultValue) => ({ type, defaultValue, allowNull: false });
        
        await queryInterface.createTable("monitoring_settings", {
            id: { type: INTEGER, primaryKey: true, autoIncrement: true },
            statusCheckerEnabled: col(BOOLEAN, true),
            statusInterval: col(INTEGER, 30),
            monitoringEnabled: col(BOOLEAN, true),
            monitoringInterval: col(INTEGER, 60),
            dataRetentionHours: col(INTEGER, 24),
            connectionTimeout: col(INTEGER, 30),
            batchSize: col(INTEGER, 10),
            createdAt: { type: DATE, defaultValue: NOW },
            updatedAt: { type: DATE, defaultValue: NOW },
        });

        await queryInterface.bulkInsert("monitoring_settings", [{
            statusCheckerEnabled: true, statusInterval: 30, monitoringEnabled: true,
            monitoringInterval: 60, dataRetentionHours: 24, connectionTimeout: 30,
            batchSize: 10, createdAt: new Date(), updatedAt: new Date(),
        }]);
        
        logger.info("Migration 0023-add-monitoring-settings completed");
    },
};
