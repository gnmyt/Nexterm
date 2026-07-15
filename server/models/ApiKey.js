const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("api_keys", {
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
    tokenHash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
    },
    prefix: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
}, {
    freezeTableName: true,
    timestamps: true,
    updatedAt: false,
});
