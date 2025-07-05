const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tableInfo = await queryInterface.describeTable("oidc_providers");
        
        if (!tableInfo.isInternal) {
            await queryInterface.addColumn("oidc_providers", "isInternal", {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }
    }
};
