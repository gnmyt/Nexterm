const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const columns = await queryInterface.describeTable("accounts");

        if (!columns.externalProvider)
            await queryInterface.addColumn("accounts", "externalProvider", { type: DataTypes.STRING, allowNull: true });
        if (!columns.externalId)
            await queryInterface.addColumn("accounts", "externalId", { type: DataTypes.STRING, allowNull: true });
        if (!columns.allowExternalLink) {
            await queryInterface.addColumn("accounts", "allowExternalLink", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
            await queryInterface.sequelize.query("UPDATE accounts SET allowExternalLink = 1 WHERE externalProvider IS NULL");
        }
    },
};
