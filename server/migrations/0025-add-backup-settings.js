const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const { INTEGER, BOOLEAN, TEXT, DATE, NOW } = Sequelize;
        const col = (type, defaultValue) => ({ type, defaultValue, allowNull: false });

        await queryInterface.createTable("backup_settings", {
            id: { type: INTEGER, primaryKey: true, autoIncrement: true },
            providers: col(TEXT, "[]"),
            scheduleInterval: col(INTEGER, 0),
            retention: col(INTEGER, 5),
            includeDatabase: col(BOOLEAN, true),
            includeRecordings: col(BOOLEAN, true),
            includeLogs: col(BOOLEAN, false),
            createdAt: { type: DATE, defaultValue: NOW },
            updatedAt: { type: DATE, defaultValue: NOW },
        });

        await queryInterface.bulkInsert("backup_settings", [{
            providers: "[]", scheduleInterval: 0, retention: 5,
            includeDatabase: true, includeRecordings: true, includeLogs: false,
            createdAt: new Date(), updatedAt: new Date(),
        }]);
    },
};
