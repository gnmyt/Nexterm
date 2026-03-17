const Sequelize = require("sequelize");
const db = require("../utils/database");
const { encrypt, decrypt } = require("../utils/encryption");
const logger = require("../utils/logger");

const encryptPassword = (provider) => {
    if (provider.password && provider.password !== "********") {
        const encrypted = encrypt(provider.password);
        provider.password = encrypted.encrypted;
        provider.passwordIV = encrypted.iv;
        provider.passwordAuthTag = encrypted.authTag;
    }
};

const decryptPassword = (provider) => {
    if (!provider?.password) return;
    try {
        provider.password = decrypt(provider.password, provider.passwordIV, provider.passwordAuthTag);
    } catch (error) {
        logger.error("Failed to decrypt password for backup provider", {
            providerId: provider.id,
            error: error.message,
        });
    }
};

module.exports = db.define("backup_providers", {
    id: { type: Sequelize.STRING, primaryKey: true },
    name: { type: Sequelize.STRING, allowNull: false },
    type: { type: Sequelize.STRING, allowNull: false },
    path: { type: Sequelize.STRING, allowNull: true },
    url: { type: Sequelize.STRING, allowNull: true },
    folder: { type: Sequelize.STRING, allowNull: true },
    username: { type: Sequelize.STRING, allowNull: true },
    password: { type: Sequelize.STRING, allowNull: true },
    passwordIV: { type: Sequelize.STRING, allowNull: true },
    passwordAuthTag: { type: Sequelize.STRING, allowNull: true },
    share: { type: Sequelize.STRING, allowNull: true },
    domain: { type: Sequelize.STRING, allowNull: true },
}, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    hooks: {
        beforeCreate: encryptPassword,
        beforeUpdate: encryptPassword,
        afterFind: (providers) => {
            if (!providers) return;
            (Array.isArray(providers) ? providers : [providers]).forEach(decryptPassword);
        },
    },
});
