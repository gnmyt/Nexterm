const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("permission_groups", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    color: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "#314BD3",
    },
    isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    isAdmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, { freezeTableName: true, createdAt: false, updatedAt: false });
