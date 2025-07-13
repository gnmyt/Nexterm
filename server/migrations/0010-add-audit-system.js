const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tableNames = await queryInterface.showAllTables();
        
        if (!tableNames.includes("audit_logs")) {
            await queryInterface.createTable("audit_logs", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                accountId: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                organizationId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                action: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                resource: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                resourceId: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                details: {
                    type: DataTypes.JSON,
                    allowNull: true,
                },
                ipAddress: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                userAgent: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                timestamp: {
                    type: DataTypes.TEXT,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
            });
            console.log("Created audit_logs table");
        }

        const orgTableInfo = await queryInterface.describeTable("organizations");
        if (!orgTableInfo.auditSettings) {
            await queryInterface.addColumn("organizations", "auditSettings", {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: JSON.stringify({
                    requireConnectionReason: false,
                    enableFileOperationAudit: true,
                    enableServerConnectionAudit: true,
                    enableIdentityManagementAudit: true,
                    enableServerManagementAudit: true,
                    enableFolderManagementAudit: true,
                    enableSessionRecording: false,
                }),
            });
        }
    }
};
