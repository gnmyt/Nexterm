const { QueryTypes } = require("sequelize");
const logger = require("../utils/logger");

const parseSettings = (value) => {
    let settings = value;
    while (typeof settings === "string") {
        try {
            settings = JSON.parse(settings);
        } catch {
            return null;
        }
    }
    return settings && typeof settings === "object" ? settings : null;
};

const dropRequireConfirmation = async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("ai_settings")) return;

    const columns = await queryInterface.describeTable("ai_settings");
    if (!columns.requireConfirmation) return;

    if (queryInterface.sequelize.getDialect() === "sqlite") {
        await queryInterface.sequelize.query("ALTER TABLE `ai_settings` DROP COLUMN `requireConfirmation`");
    } else {
        await queryInterface.removeColumn("ai_settings", "requireConfirmation");
    }
};

const renameAuditSetting = async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("organizations")) return;

    const organizations = await queryInterface.sequelize.query(
        "SELECT id, auditSettings FROM organizations WHERE auditSettings IS NOT NULL",
        { type: QueryTypes.SELECT },
    );

    for (const org of organizations) {
        const settings = parseSettings(org.auditSettings);
        if (!settings || !Object.hasOwn(settings, "enableAIOperationAudit")) continue;

        if (settings.enableAgentOperationAudit === undefined) settings.enableAgentOperationAudit = settings.enableAIOperationAudit;
        delete settings.enableAIOperationAudit;

        await queryInterface.sequelize.query(
            "UPDATE organizations SET auditSettings = ? WHERE id = ?",
            { replacements: [JSON.stringify(settings), org.id], type: QueryTypes.UPDATE },
        );
    }
};

module.exports = {
    async up(queryInterface) {
        await dropRequireConfirmation(queryInterface);
        await renameAuditSetting(queryInterface);
        logger.info("Migration 0045-cleanup-ai-agent-settings completed");
    },
};
