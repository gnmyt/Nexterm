const { DataTypes } = require("sequelize");
const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (tables.includes("device_codes")) return;

        await queryInterface.createTable("device_codes", {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
            code: { type: DataTypes.STRING(9), allowNull: false, unique: true },
            token: { type: DataTypes.STRING(64), allowNull: false, unique: true },
            sessionId: { type: DataTypes.INTEGER, allowNull: true },
            ipAddress: { type: DataTypes.STRING, allowNull: false },
            userAgent: { type: DataTypes.STRING, allowNull: false },
            clientType: { type: DataTypes.STRING, allowNull: false },
            createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        });

        await queryInterface.addIndex("device_codes", ["code"], { unique: true });
        await queryInterface.addIndex("device_codes", ["token"], { unique: true });
        await queryInterface.addIndex("device_codes", ["createdAt"]);
        
        logger.info("Created device_codes table");
    },
};
