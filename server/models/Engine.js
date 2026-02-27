const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("engines", {
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        registrationToken: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        },
        lastConnectedAt: {
            type: Sequelize.DATE,
            allowNull: true,
        },
    },
    { freezeTableName: true, timestamps: true },
);
