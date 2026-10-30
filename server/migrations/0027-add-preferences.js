const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const isMysql = queryInterface.sequelize.options.dialect === 'mysql';

        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");
        }

        const accountsColumns = await queryInterface.describeTable("accounts");

        if (!accountsColumns.preferences) {
            await queryInterface.addColumn("accounts", "preferences", {
                type: DataTypes.JSON,
                allowNull: true,
            });
        }

        await queryInterface.sequelize.query(
            "UPDATE accounts SET preferences = ? WHERE preferences IS NULL OR preferences = ''",
            { replacements: [JSON.stringify({})] }
        );

        await queryInterface.changeColumn("accounts", "preferences", {
            type: DataTypes.JSON,
            defaultValue: {},
            allowNull: false,
        });

        // Restore Foreign Key Checks
        if (isMysql) {
            await queryInterface.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
        } else {
            await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
        }
    },
};
