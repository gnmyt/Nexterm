const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const db = require("../utils/database");

module.exports = db.define("integrations", {
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "organizations",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    config: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    lastSyncAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
}, { 
    freezeTableName: true,
    timestamps: true,
    hooks: {
        afterFind: (integrations) => {
            const parseConfig = (integration) => {
                if (integration && integration.config && typeof integration.config === 'string') {
                    try {
                        integration.config = JSON.parse(integration.config);
                    } catch (e) {
                        logger.error('Failed to parse Integration config', { integrationId: integration.id, error: e.message });
                    }
                }
            };
            
            if (Array.isArray(integrations)) {
                integrations.forEach(parseConfig);
            } else if (integrations) {
                parseConfig(integrations);
            }
        },
    },
});
