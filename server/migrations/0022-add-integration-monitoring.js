const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await queryInterface.addColumn("monitoring_data", "integrationId", {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: "integrations", key: "id" },
                onDelete: "CASCADE",
            }, { transaction });

            await queryInterface.addColumn("monitoring_snapshot", "integrationId", {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: "integrations", key: "id" },
                onDelete: "CASCADE",
            }, { transaction });

            await queryInterface.changeColumn("monitoring_data", "entryId", {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: "entries", key: "id" },
                onDelete: "CASCADE",
            }, { transaction });

            await queryInterface.changeColumn("monitoring_snapshot", "entryId", {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: "entries", key: "id" },
                onDelete: "CASCADE",
            }, { transaction });

            await queryInterface.addIndex("monitoring_data", ["integrationId", "timestamp"], { transaction });
            await queryInterface.addIndex("monitoring_snapshot", ["integrationId"], { transaction });

            await transaction.commit();
            logger.info("Migration 0022-add-integration-monitoring completed successfully");
        } catch (error) {
            await transaction.rollback();
            logger.error("Migration 0022-add-integration-monitoring failed", { error: error.message });
            throw error;
        }
    },
};
