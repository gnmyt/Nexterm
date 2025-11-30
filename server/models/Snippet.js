const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("snippets", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
    command: {
        type: Sequelize.TEXT,
        allowNull: false,
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
    }
}, { freezeTableName: true, createdAt: false, updatedAt: false });