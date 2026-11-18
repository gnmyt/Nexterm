const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("trusted_hosts", {
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "accounts", key: "id" },
        onDelete: "CASCADE",
    },
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
    },
    kind: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    host: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    port: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    algorithm: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    fingerprint: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    raw: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    subject: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    issuer: {
        type: Sequelize.STRING,
        allowNull: true,
    },
}, { freezeTableName: true, timestamps: true });
