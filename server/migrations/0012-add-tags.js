const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const isMysql = queryInterface.sequelize.options.dialect === 'mysql';

        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");
        }

        await queryInterface.createTable("tags", {
            id: { 
                type: DataTypes.INTEGER, 
                autoIncrement: true, 
                primaryKey: true, 
                allowNull: false 
            },
            accountId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "accounts", key: "id" },
                onDelete: "CASCADE",
            },
            name: { 
                type: DataTypes.STRING, 
                allowNull: false 
            },
            color: { 
                type: DataTypes.STRING, 
                allowNull: false 
            },
            createdAt: { 
                type: DataTypes.DATE, 
                allowNull: false, 
                defaultValue: DataTypes.NOW 
            },
            updatedAt: { 
                type: DataTypes.DATE, 
                allowNull: false, 
                defaultValue: DataTypes.NOW 
            },
        });

        await queryInterface.createTable("entry_tags", {
            entryId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                references: { model: "entries", key: "id" },
                onDelete: "CASCADE",
            },
            tagId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                references: { model: "tags", key: "id" },
                onDelete: "CASCADE",
            },
            createdAt: { 
                type: DataTypes.DATE, 
                allowNull: false, 
                defaultValue: DataTypes.NOW 
            },
        });

        // Restore Foreign Key Checks
        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
        }
    },
};
