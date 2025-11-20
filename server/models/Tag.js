const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("tags", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
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
    color: {
        type: Sequelize.STRING,
        allowNull: false,
    },
}, { 
    freezeTableName: true,
    timestamps: true,
});
