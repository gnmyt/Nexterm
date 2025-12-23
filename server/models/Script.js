const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("scripts", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "accounts", key: "id" },
        onDelete: "CASCADE",
    },
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
    },
    sourceId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "sources", key: "id" },
        onDelete: "CASCADE",
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    content: {
        type: Sequelize.TEXT,
        allowNull: false,
    },
    sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    osFilter: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
    },
}, { freezeTableName: true, createdAt: true, updatedAt: true });
