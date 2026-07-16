const logger = require("../utils/logger");
const { encrypt } = require("../utils/encryption");

module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("ai_settings")) return;

        const columns = await queryInterface.describeTable("ai_settings");
        const isSqlite = queryInterface.sequelize.getDialect() === "sqlite";

        const addColumn = async (name, definition) => {
            if (!columns[name]) await queryInterface.addColumn("ai_settings", name, definition);
        };

        await addColumn("requireConfirmation", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
        await addColumn("authMethod", { type: Sequelize.STRING, allowNull: false, defaultValue: "api_key" });
        await addColumn("oauthProvider", { type: Sequelize.STRING, allowNull: true });
        await addColumn("oauthAccountId", { type: Sequelize.STRING, allowNull: true });
        await addColumn("oauthExpiresAt", { type: Sequelize.BIGINT, allowNull: true });
        await addColumn("oauthVerifier", { type: Sequelize.TEXT, allowNull: true });

        for (const field of ["apiKey", "oauthAccessToken", "oauthRefreshToken"]) {
            await addColumn(`${field}Encrypted`, { type: Sequelize.BLOB, allowNull: true });
            await addColumn(`${field}IV`, { type: Sequelize.STRING, allowNull: true });
            await addColumn(`${field}AuthTag`, { type: Sequelize.STRING, allowNull: true });
        }

        if (columns.apiKey) {
            const [rows] = await queryInterface.sequelize.query("SELECT * FROM ai_settings");
            for (const row of rows) {
                if (!row.apiKey || row.apiKeyEncrypted) continue;
                const enc = encrypt(row.apiKey);
                await queryInterface.sequelize.query(
                    "UPDATE ai_settings SET apiKeyEncrypted = ?, apiKeyIV = ?, apiKeyAuthTag = ? WHERE id = ?",
                    { replacements: [Buffer.from(enc.encrypted, "hex"), enc.iv, enc.authTag, row.id] },
                );
            }
            await queryInterface.removeColumn("ai_settings", "apiKey");
        }

        if (!isSqlite) {
            await queryInterface.changeColumn("ai_settings", "provider", {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }

        logger.info("Migration 0035-add-ai-agent completed");
    },
};
