const Sequelize = require("sequelize");
const db = require("../utils/database");

const parseJsonColumn = (instance, column) => {
    if (instance?.[column] && typeof instance[column] === "string") {
        try {
            instance[column] = JSON.parse(instance[column]);
        } catch (e) {}
    }
};

const JSON_COLUMNS = ["auditSettings", "sessionSettings"];

const parseSettings = (instance) => JSON_COLUMNS.forEach(column => parseJsonColumn(instance, column));

const DEFAULT_SESSION_SETTINGS = { enableLiveSessionSharing: false };

const Organization = db.define("organizations", {
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
    },
    sessionSettings: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: DEFAULT_SESSION_SETTINGS,
    }
}, {
    freezeTableName: true,
    hooks: {
        afterFind: (result) => {
            if (Array.isArray(result)) result.forEach(parseSettings);
            else parseSettings(result);
        }
    }
});

module.exports = Organization;
module.exports.DEFAULT_SESSION_SETTINGS = DEFAULT_SESSION_SETTINGS;