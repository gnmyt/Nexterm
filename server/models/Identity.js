const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define(
    "identities",
    {
        organizationId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "organizations",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        accountId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "accounts",
                key: "id",
            },
            onDelete: "CASCADE",
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        type: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        username: {
            type: Sequelize.STRING,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        timestamps: true,
    }
);
