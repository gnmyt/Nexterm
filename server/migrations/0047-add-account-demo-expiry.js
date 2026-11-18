module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("accounts")) return;

        const columns = await queryInterface.describeTable("accounts");
        if (columns.demoExpiresAt) return;

        await queryInterface.addColumn("accounts", "demoExpiresAt", {
            type: Sequelize.DATE,
            allowNull: true,
        });
    },
};
