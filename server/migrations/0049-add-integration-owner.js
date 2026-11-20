const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("integrations")) return;

        const columns = await queryInterface.describeTable("integrations");
        if (!columns.accountId) {
            await queryInterface.addColumn("integrations", "accountId", {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "accounts", key: "id" },
                onDelete: "CASCADE",
            });
        }

        await queryInterface.sequelize.query(
            `UPDATE integrations
             SET accountId = (
                 SELECT folders.accountId FROM folders
                 WHERE folders.integrationId = integrations.id AND folders.accountId IS NOT NULL
                 ORDER BY CASE WHEN folders.type = 'integration-root' THEN 0 ELSE 1 END, folders.id
                 LIMIT 1
             )
             WHERE organizationId IS NULL AND accountId IS NULL`
        );
    },
};
