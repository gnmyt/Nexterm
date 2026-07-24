const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const isMysql = queryInterface.sequelize.options.dialect === 'mysql';

        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");
        }

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

        // Restore Foreign Key Checks
        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
        }
    },
};
