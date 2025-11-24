const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("entries_identities", {
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
    identityId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
            model: "identities",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    isDefault: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
}, { 
    freezeTableName: true,
    timestamps: true,
    createdAt: true,
    updatedAt: false,
});
