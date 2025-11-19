const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("entries", {
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
});
