module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("scripts")) return;

        const columns = await queryInterface.describeTable("scripts");
        const stale = ["createdAt", "updatedAt"].filter(column => columns[column]);
        if (stale.length === 0) return;

        const isSqlite = queryInterface.sequelize.getDialect() === "sqlite";
        if (isSqlite) await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");

        try {
            for (const column of stale) {
                if (isSqlite) {
                    await queryInterface.sequelize.query(`ALTER TABLE \`scripts\` DROP COLUMN \`${column}\``);
                } else {
                    await queryInterface.removeColumn("scripts", column);
                }
            }
        } finally {
            if (isSqlite) await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");
        }
    },
};
