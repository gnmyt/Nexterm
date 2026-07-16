const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();

        const columns = await queryInterface.describeTable("folders");
        if (!columns.config) {
            await queryInterface.addColumn("folders", "config", {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: null,
            });
        }

        if (!tables.includes("integrations")) {
            logger.info("Migration 0037 completed (no integrations to migrate)");
            return;
        }

        const sequelize = queryInterface.sequelize;
        const { SELECT } = sequelize.QueryTypes;

        const integrations = await sequelize.query(
            "SELECT id, name, organizationId FROM integrations",
            { type: SELECT },
        );

        for (const integration of integrations) {
            try {
                const existingRoot = await sequelize.query(
                    "SELECT id FROM folders WHERE integrationId = ? AND type = 'integration-root' LIMIT 1",
                    { type: SELECT, replacements: [integration.id] },
                );
                if (existingRoot.length > 0) continue;

                const nodeFolders = await sequelize.query(
                    "SELECT id, name, accountId, organizationId, parentId, position FROM folders WHERE integrationId = ? AND type = 'pve-node'",
                    { type: SELECT, replacements: [integration.id] },
                );
                if (nodeFolders.length === 0) continue;

                const sample = nodeFolders[0];

                await sequelize.query(
                    "INSERT INTO folders (name, accountId, organizationId, parentId, integrationId, position, type, config) " +
                    "VALUES (?, ?, ?, ?, ?, ?, 'integration-root', ?)",
                    {
                        replacements: [
                            integration.name,
                            sample.accountId ?? null,
                            integration.organizationId ?? sample.organizationId ?? null,
                            sample.parentId ?? null,
                            integration.id,
                            sample.position ?? 0,
                            JSON.stringify({ role: "integration-root" }),
                        ],
                    },
                );

                const [root] = await sequelize.query(
                    "SELECT id FROM folders WHERE integrationId = ? AND type = 'integration-root' LIMIT 1",
                    { type: SELECT, replacements: [integration.id] },
                );

                const prefix = `${integration.name} - `;
                for (const folder of nodeFolders) {
                    const nodeName = folder.name.startsWith(prefix)
                        ? folder.name.slice(prefix.length)
                        : folder.name;

                    await sequelize.query(
                        "UPDATE folders SET parentId = ?, type = 'integration-node', name = ?, config = ? WHERE id = ?",
                        {
                            replacements: [
                                root.id,
                                nodeName,
                                JSON.stringify({ nodeKey: nodeName }),
                                folder.id,
                            ],
                        },
                    );
                }

                logger.info("Migrated legacy integration layout", {
                    integrationId: integration.id,
                    nodes: nodeFolders.length,
                });
            } catch (error) {
                logger.error("Failed to migrate integration layout", {
                    integrationId: integration.id,
                    error: error.message,
                });
            }
        }
    },
};
