module.exports = {
    async up(queryInterface, Sequelize) {
        const { STRING, DATE, INTEGER } = Sequelize;

        const tables = await queryInterface.showAllTables();
        if (tables.map(t => t.toLowerCase?.() || t).includes("api_keys")) return;

        await queryInterface.createTable("api_keys", {
            id: {
                type: INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            accountId: {
                type: INTEGER,
                allowNull: false,
                references: { model: "accounts", key: "id" },
                onDelete: "CASCADE",
            },
            name: {
                type: STRING,
                allowNull: false,
            },
            tokenHash: {
                type: STRING,
                allowNull: false,
                unique: true,
            },
            prefix: {
                type: STRING,
                allowNull: false,
            },
            lastUsedAt: {
                type: DATE,
                allowNull: true,
            },
            expiresAt: {
                type: DATE,
                allowNull: true,
            },
            createdAt: {
                type: DATE,
                allowNull: false,
            },
        });
    },
};
