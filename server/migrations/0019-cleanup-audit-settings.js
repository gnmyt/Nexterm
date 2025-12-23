module.exports = {
    async up(queryInterface) {
        const organizations = await queryInterface.sequelize.query(
            "SELECT id, auditSettings FROM organizations WHERE auditSettings IS NOT NULL",
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        for (const org of organizations) {
            let settings = org.auditSettings;

            if (typeof settings === "string") {
                while (typeof settings === "string") {
                    try {
                        settings = JSON.parse(settings);
                    } catch {
                        break;
                    }
                }
            }

            if (typeof settings !== "object" || settings === null) {
                continue;
            }

            delete settings.enableAppInstallationAudit;
            delete settings.enableSessionRecording;

            await queryInterface.sequelize.query(
                "UPDATE organizations SET auditSettings = ? WHERE id = ?",
                {
                    replacements: [JSON.stringify(settings), org.id],
                    type: queryInterface.sequelize.QueryTypes.UPDATE,
                }
            );
        }
    },
};
