module.exports = {
    async up(queryInterface, Sequelize) {
        const tables = await queryInterface.showAllTables();
        if (tables.includes("ssh_certificate_authorities")) {
            const columns = await queryInterface.describeTable("ssh_certificate_authorities");
            const json = { type: Sequelize.JSON, allowNull: false, defaultValue: [] };
            if (!columns.selectorGroups) await queryInterface.addColumn("ssh_certificate_authorities", "selectorGroups", json);
            if (!columns.domains) await queryInterface.addColumn("ssh_certificate_authorities", "domains", json);
            if (!columns.environments) await queryInterface.addColumn("ssh_certificate_authorities", "environments", json);
            if (!columns.ttlByGroup) await queryInterface.addColumn("ssh_certificate_authorities", "ttlByGroup", json);
            if (!columns.ttlByEnvironment) await queryInterface.addColumn("ssh_certificate_authorities", "ttlByEnvironment", json);
        }

        const accounts = await queryInterface.describeTable("accounts");
        if (!accounts.idpSubject) {
            await queryInterface.addColumn("accounts", "idpSubject", {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },
};
