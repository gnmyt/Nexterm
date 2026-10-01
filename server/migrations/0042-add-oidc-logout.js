module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();

        if (tables.includes("oidc_providers")) {
            const providerColumns = await queryInterface.describeTable("oidc_providers");
            if (!providerColumns.endSessionEndpoint) {
                await queryInterface.addColumn("oidc_providers", "endSessionEndpoint", {
                    type: Sequelize.STRING,
                    allowNull: true,
                });
            }
        }

        if (tables.includes("sessions")) {
            const sessionColumns = await queryInterface.describeTable("sessions");
            const columns = {
                oidcProviderId: Sequelize.INTEGER,
                oidcIdTokenEncrypted: Sequelize.TEXT,
                oidcIdTokenIV: Sequelize.STRING,
                oidcIdTokenAuthTag: Sequelize.STRING,
            };

            for (const [name, type] of Object.entries(columns)) {
                if (!sessionColumns[name]) {
                    await queryInterface.addColumn("sessions", name, { type, allowNull: true });
                }
            }
        }
    },
};
