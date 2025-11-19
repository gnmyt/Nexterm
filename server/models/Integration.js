const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("integrations", {
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "organizations",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    config: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    lastSyncAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
}, { 
    freezeTableName: true,
    timestamps: true,
});
