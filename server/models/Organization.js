const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("organizations", {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    description: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    auditSettings: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {
            requireConnectionReason: false,
            enableFileOperationAudit: true,
            enableServerConnectionAudit: true,
            enableIdentityManagementAudit: true,
            enableServerManagementAudit: true,
            enableFolderManagementAudit: true,
            enableSessionRecording: false,
            enableScriptExecutionAudit: true,
            enableAppInstallationAudit: true,
        },
    }
}, { freezeTableName: true });