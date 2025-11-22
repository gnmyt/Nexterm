const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        await queryInterface.addColumn("accounts", "sessionSync", {
            type: DataTypes.STRING,
            defaultValue: "same_browser",
            allowNull: false,
        });

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
