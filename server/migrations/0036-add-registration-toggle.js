const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tableInfo = await queryInterface.describeTable("oidc_providers");

        if (!tableInfo.allowRegistration) {
            await queryInterface.addColumn("oidc_providers", "allowRegistration", {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }
    },
};
