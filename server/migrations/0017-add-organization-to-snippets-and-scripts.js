const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        const snippetsColumns = await queryInterface.describeTable("snippets");
        if (!snippetsColumns.organizationId) {
            await queryInterface.addColumn("snippets", "organizationId", {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "organizations", key: "id" },
                onDelete: "CASCADE",
            });
        }

        const scriptsColumns = await queryInterface.describeTable("scripts");
        if (!scriptsColumns.organizationId) {
            await queryInterface.addColumn("scripts", "organizationId", {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: "organizations", key: "id" },
                onDelete: "CASCADE",
            });
        }

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
