const Sequelize = require("sequelize");
const db = require("../utils/database");
const crypto = require("crypto");

const hashSessionToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

module.exports = db.define("sessions", {
    accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    token: {
        type: Sequelize.VIRTUAL,
    },
    tokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
    },
    ip: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    userAgent: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastActivity: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    oidcProviderId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    oidcIdTokenEncrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    oidcIdTokenIV: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    oidcIdTokenAuthTag: {
        type: Sequelize.STRING,
        allowNull: true,
    },
}, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    hooks: {
        beforeValidate: (session) => {
            if (session.tokenHash) return;
            const token = crypto.randomBytes(48).toString("hex");
            session.setDataValue("token", token);
            session.setDataValue("tokenHash", hashSessionToken(token));
        },
    },
});

module.exports.hashSessionToken = hashSessionToken;
