const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("themes", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    css: {
        type: Sequelize.TEXT,
        allowNull: false,
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "accounts", key: "id" },
        onDelete: "CASCADE",
    },
    sourceId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "sources", key: "id" },
        onDelete: "CASCADE",
    },
}, {
    freezeTableName: true,
    createdAt: true,
    updatedAt: true,
});
