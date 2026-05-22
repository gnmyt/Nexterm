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
        isLocal: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    { freezeTableName: true, timestamps: true },
);
