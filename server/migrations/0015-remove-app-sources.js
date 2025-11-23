module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        await queryInterface.dropTable("app_sources");

        await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
    },
};
