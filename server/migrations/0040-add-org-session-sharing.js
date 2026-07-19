const DEFAULT_SESSION_SETTINGS = {
    enableLiveSessionSharing: false,
};

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("organizations")) return;

        const columns = await queryInterface.describeTable("organizations");
        if (columns.sessionSettings) return;

        await queryInterface.addColumn("organizations", "sessionSettings", {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: DEFAULT_SESSION_SETTINGS,
        });

        await queryInterface.sequelize.query(
            "UPDATE `organizations` SET `sessionSettings` = :settings WHERE `sessionSettings` IS NULL",
            { replacements: { settings: JSON.stringify(DEFAULT_SESSION_SETTINGS) } },
        );
    },
};
