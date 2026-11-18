const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const columns = await queryInterface.describeTable("sessions");

        if (!columns.createdAt) {
            await queryInterface.addColumn("sessions", "createdAt", { type: DataTypes.DATE, allowNull: true });
            await queryInterface.sequelize.query("UPDATE sessions SET createdAt = :now", { replacements: { now: new Date() } });
        }
        if (!columns.expiresAt)
            await queryInterface.addColumn("sessions", "expiresAt", { type: DataTypes.DATE, allowNull: true });

        const tables = await queryInterface.showAllTables();
        if (!tables.includes("session_settings")) {
            await queryInterface.createTable("session_settings", {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                idleTimeoutDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
                maxLifetimeDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 90 },
                createdAt: { type: DataTypes.DATE, allowNull: false },
                updatedAt: { type: DataTypes.DATE, allowNull: false },
            });
            await queryInterface.bulkInsert("session_settings", [{
                idleTimeoutDays: 14, maxLifetimeDays: 90, createdAt: new Date(), updatedAt: new Date(),
            }]);
        }
    },
};
