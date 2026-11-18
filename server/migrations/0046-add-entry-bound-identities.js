const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const columns = await queryInterface.describeTable("identities");
        if (!columns.entryId) {
            await queryInterface.addColumn("identities", "entryId", {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "entries", key: "id" },
                onDelete: "CASCADE",
            });
        }

        await queryInterface.sequelize.query(
            `UPDATE identities
             SET entryId = (SELECT MIN(entryId) FROM entries_identities WHERE identityId = identities.id)
             WHERE id IN (
                 SELECT identityId FROM entries_identities
                 WHERE identityId NOT IN (SELECT identityId FROM folder_identity_profiles)
                 GROUP BY identityId HAVING COUNT(*) = 1
             )`
        );
    },
};
