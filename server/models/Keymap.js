const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("keymaps", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "accounts", key: "id" },
        onDelete: "CASCADE",
    },
    action: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    key: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
    },
}, {
    freezeTableName: true,
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ["accountId", "action"],
        },
    ],
});
