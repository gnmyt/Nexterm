module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("accounts")) return;

        const columns = await queryInterface.describeTable("accounts");
        if (columns.avatarHash) return;

        await queryInterface.addColumn("accounts", "avatarHash", {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },
};
