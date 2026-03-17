const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.createTable("sources", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            url: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            isDefault: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            lastSyncStatus: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            snippetCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            scriptCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        });

        const snippetsColumns = await queryInterface.describeTable("snippets");
        if (!snippetsColumns.sourceId) {
            await queryInterface.addColumn("snippets", "sourceId", {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "sources", key: "id" },
                onDelete: "CASCADE",
            });
        }

        const scriptsColumns = await queryInterface.describeTable("scripts");
        if (!scriptsColumns.sourceId) {
            await queryInterface.addColumn("scripts", "sourceId", {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "sources", key: "id" },
                onDelete: "CASCADE",
            });
        }
    },
};
