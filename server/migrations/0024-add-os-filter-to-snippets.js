const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        
        if (tables.includes("snippets")) {
            const columns = await queryInterface.describeTable("snippets");
            if (!columns.osFilter) {
                await queryInterface.addColumn("snippets", "osFilter", {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: null,
                });
            }
        }

        if (tables.includes("scripts")) {
            const columns = await queryInterface.describeTable("scripts");
            if (!columns.osFilter) {
                await queryInterface.addColumn("scripts", "osFilter", {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: null,
                });
            }
        }
        
        logger.info("Migration 0024-add-os-filter-to-snippets completed");
    },
};
