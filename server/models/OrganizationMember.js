const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("organization_members", {
    organizationId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    role: {
        type: Sequelize.ENUM("owner", "member"),
        defaultValue: "member",
        allowNull: false,
    },
    status: {
        type: Sequelize.ENUM("pending", "active"),
        defaultValue: "pending",
        allowNull: false,
    },
    invitedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
}, { freezeTableName: true });