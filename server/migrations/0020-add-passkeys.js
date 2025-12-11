const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        await queryInterface.createTable("passkeys", {
            id: { 
                type: DataTypes.INTEGER, 
                autoIncrement: true, 
                primaryKey: true, 
                allowNull: false 
            },
            credentialId: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true,
            },
            credentialPublicKey: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            counter: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            credentialDeviceType: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            credentialBackedUp: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            transports: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            accountId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "accounts", key: "id" },
                onDelete: "CASCADE",
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "Passkey",
            },
            createdAt: { 
                type: DataTypes.DATE, 
                allowNull: false, 
                defaultValue: DataTypes.NOW 
            },
        });

        await queryInterface.addIndex("passkeys", ["accountId"], {
            name: "passkeys_account_id_idx"
        });

        await queryInterface.addIndex("passkeys", ["credentialId"], {
            unique: true,
            name: "passkeys_credential_id_unique"
        });

        await queryInterface.addColumn("accounts", "currentChallenge", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
