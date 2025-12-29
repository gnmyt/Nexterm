const Sequelize = require("sequelize");
const db = require("../utils/database");

const parseAuditSettings = (instance) => {
    if (instance?.auditSettings && typeof instance.auditSettings === "string") {
        try {
            instance.auditSettings = JSON.parse(instance.auditSettings);
        } catch (e) {}
    }
};

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
            enableScriptExecutionAudit: true,
            enableSessionRecording: false,
            recordingRetentionDays: 90,
        },
    }
}, {
    freezeTableName: true,
    hooks: {
        afterFind: (result) => {
            if (Array.isArray(result)) result.forEach(parseAuditSettings);
            else parseAuditSettings(result);
        }
    }
});