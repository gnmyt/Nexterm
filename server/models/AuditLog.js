const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("audit_logs", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    action: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    resource: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    resourceId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    details: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    userAgent: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    reason: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    timestamp: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: () => new Date().toISOString(),
        get() {
            const rawValue = this.getDataValue("timestamp");
            return rawValue ? new Date(rawValue) : null;
        },
        set(value) {
            if (value instanceof Date) {
                this.setDataValue("timestamp", value.toISOString());
            } else if (typeof value === "string") {
                this.setDataValue("timestamp", new Date(value).toISOString());
            } else {
                this.setDataValue("timestamp", new Date().toISOString());
            }
        },
    },
}, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
});
