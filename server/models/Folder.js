const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const db = require("../utils/database");

module.exports = db.define("folders", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
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
    parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "folders",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    integrationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "integrations",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    position: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    type: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
    },
    config: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
    }
}, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    hooks: {
        afterFind: (folders) => {
            const parseConfig = (folder) => {
                if (folder && folder.config && typeof folder.config === 'string') {
                    try {
                        folder.config = JSON.parse(folder.config);
                    } catch (e) {
                        logger.error('Failed to parse Folder config', { folderId: folder.id, error: e.message });
                    }
                }
            };

            if (Array.isArray(folders)) {
                folders.forEach(parseConfig);
            } else if (folders) {
                parseConfig(folders);
            }
        },
    },
});