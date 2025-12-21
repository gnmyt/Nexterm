const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("entry_tags", {
    entryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: "entries",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    tagId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: "tags",
            key: "id",
        },
        onDelete: "CASCADE",
    },
}, { 
    freezeTableName: true,
    timestamps: true,
    createdAt: true,
    updatedAt: false,
});
