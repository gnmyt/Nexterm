const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.createTable("themes", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            css: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            accountId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "accounts", key: "id" },
                onDelete: "CASCADE",
            },
            sourceId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "sources", key: "id" },
                onDelete: "CASCADE",
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

        await queryInterface.addColumn("accounts", "activeThemeId", {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "themes", key: "id" },
            onDelete: "SET NULL",
        });

        const tableDesc = await queryInterface.describeTable("sources");
        if (!tableDesc.themeCount) {
            await queryInterface.addColumn("sources", "themeCount", {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }
    },
};
