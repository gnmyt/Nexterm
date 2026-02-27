const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const isMysql = queryInterface.sequelize.options.dialect === 'mysql';

        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");
        }

        await queryInterface.createTable("keymaps", {
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
            action: { 
                type: DataTypes.STRING, 
                allowNull: false 
            },
            key: { 
                type: DataTypes.STRING, 
                allowNull: false 
            },
            enabled: { 
                type: DataTypes.BOOLEAN, 
                defaultValue: true 
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

        await queryInterface.addIndex("keymaps", ["accountId", "action"], {
            unique: true,
            name: "keymaps_account_action_unique"
        });

        // Restore Foreign Key Checks
        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
        }
    },
};
