module.exports = {
    async up(queryInterface, Sequelize) {
        const oidcColumns = await queryInterface.describeTable("oidc_providers");

        if (!oidcColumns.groupsAttribute) {
            await queryInterface.addColumn("oidc_providers", "groupsAttribute", {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }

        if (!oidcColumns.requiredGroup) {
            await queryInterface.addColumn("oidc_providers", "requiredGroup", {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }

        if (!oidcColumns.groupMappings) {
            await queryInterface.addColumn("oidc_providers", "groupMappings", {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: [],
            });
        }

        const memberColumns = await queryInterface.describeTable("organization_members");

        if (!memberColumns.managedByOidc) {
            await queryInterface.addColumn("organization_members", "managedByOidc", {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }
    },
};
