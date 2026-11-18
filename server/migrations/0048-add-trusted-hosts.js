const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (tables.includes("trusted_hosts")) return;

        await queryInterface.createTable("trusted_hosts", {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            accountId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "accounts", key: "id" },
                onDelete: "CASCADE",
            },
            organizationId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "organizations", key: "id" },
                onDelete: "CASCADE",
            },
            kind: { type: DataTypes.STRING, allowNull: false },
            host: { type: DataTypes.STRING, allowNull: false },
            port: { type: DataTypes.INTEGER, allowNull: false },
            algorithm: { type: DataTypes.STRING, allowNull: true },
            fingerprint: { type: DataTypes.STRING, allowNull: false },
            raw: { type: DataTypes.TEXT, allowNull: true },
            subject: { type: DataTypes.STRING, allowNull: true },
            issuer: { type: DataTypes.STRING, allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE, allowNull: false },
        });

        await queryInterface.addIndex("trusted_hosts", ["accountId", "organizationId", "kind", "host", "port"], {
            name: "trusted_hosts_endpoint",
        });
    },
};
