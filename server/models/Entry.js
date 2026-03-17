const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const db = require("../utils/database");

module.exports = db.define("entries", {
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "accounts",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "organizations",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    folderId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "folders",
            key: "id",
        },
        onDelete: "SET NULL",
    },
    integrationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "integrations",
            key: "id",
        },
        onDelete: "SET NULL",
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    renderer: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    icon: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    config: {
        type: Sequelize.JSON,
        allowNull: true,
    },
}, { 
    freezeTableName: true,
    timestamps: true,
    hooks: {
        afterFind: (entries) => {
            const parseConfig = (entry) => {
                if (entry && entry.config && typeof entry.config === 'string') {
                    try {
                        entry.config = JSON.parse(entry.config);
                    } catch (e) {
                        logger.error('Failed to parse Entry config', { entryId: entry.id, error: e.message });
                    }
                }
            };
            
            if (Array.isArray(entries)) {
                entries.forEach(parseConfig);
            } else if (entries) {
                parseConfig(entries);
            }
        },
    },
});
