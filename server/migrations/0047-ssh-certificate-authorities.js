module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("ssh_certificate_authorities")) {
            await queryInterface.createTable("ssh_certificate_authorities", {
                id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
                organizationId: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: { model: "organizations", key: "id" },
                    onDelete: "CASCADE",
                },
                name: { type: Sequelize.STRING, allowNull: false },
                backend: { type: Sequelize.STRING, allowNull: false },
                enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
                ttlSeconds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 300 },
                sourceAddress: { type: Sequelize.STRING, allowNull: true },
                extraPrincipals: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
                groupPrincipalMappings: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
                keyIdTemplate: { type: Sequelize.STRING, allowNull: false, defaultValue: "{{username}}" },
                config: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
                secretEncrypted: { type: Sequelize.BLOB, allowNull: true },
                secretIV: { type: Sequelize.STRING, allowNull: true },
                secretAuthTag: { type: Sequelize.STRING, allowNull: true },
                createdAt: { type: Sequelize.DATE, allowNull: false },
                updatedAt: { type: Sequelize.DATE, allowNull: false },
            });
        }

        const accounts = await queryInterface.describeTable("accounts");
        if (!accounts.oidcGroups) {
            await queryInterface.addColumn("accounts", "oidcGroups", {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
            });
        }
    },
};
