const { DataTypes } = require("sequelize");
const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        const tableNames = await queryInterface.showAllTables();

        if (!tableNames.includes("scripts")) {
            await queryInterface.createTable("scripts", {
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: "accounts", key: "id" },
                    onDelete: "CASCADE",
                },
                description: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
                content: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                },
            });
        }

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
