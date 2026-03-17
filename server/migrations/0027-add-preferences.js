 const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        await queryInterface.addColumn("accounts", "preferences", {
            type: DataTypes.JSON,
            defaultValue: {},
            allowNull: false,
        });

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
