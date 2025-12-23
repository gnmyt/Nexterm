const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        const snippetsColumns = await queryInterface.describeTable("snippets");
        if (!snippetsColumns.sortOrder) {
            await queryInterface.addColumn("snippets", "sortOrder", {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }

        const scriptsColumns = await queryInterface.describeTable("scripts");
        if (!scriptsColumns.sortOrder) {
            await queryInterface.addColumn("scripts", "sortOrder", {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            });
        }

        await queryInterface.sequelize.query(`
            UPDATE snippets SET sortOrder = id WHERE sortOrder = 0
        `);
        await queryInterface.sequelize.query(`
            UPDATE scripts SET sortOrder = id WHERE sortOrder = 0
        `);

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
