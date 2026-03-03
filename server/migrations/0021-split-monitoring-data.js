const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.createTable("monitoring_snapshot", {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            entryId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: "entries", key: "id" },
                onDelete: "CASCADE",
            },
            updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false },
            status: { type: DataTypes.STRING, allowNull: true },
            memoryTotal: { type: DataTypes.BIGINT, allowNull: true },
            disk: { type: DataTypes.JSON, allowNull: true },
            network: { type: DataTypes.JSON, allowNull: true },
            processList: { type: DataTypes.JSON, allowNull: true },
            osInfo: { type: DataTypes.JSON, allowNull: true },
        });

        const tableInfo = await queryInterface.describeTable("monitoring_data");
        const columnsToRemove = ["memoryTotal", "disk", "network", "processList", "osInfo"];
        
        for (const col of columnsToRemove) {
            if (tableInfo[col]) {
                await queryInterface.removeColumn("monitoring_data", col);
            }
        }

        if (!tableInfo.status) {
            await queryInterface.addColumn("monitoring_data", "status", { type: DataTypes.STRING, allowNull: true });
        }
    },
};
