const Sequelize = require("sequelize");
const db = require("../utils/database");
const speakeasy = require("speakeasy");
const logger = require("../utils/logger");
const { encrypt, decrypt } = require("../utils/encryption");

const encryptTotpSecret = (account) => {
    if (!account.totpSecret) return;

    const encrypted = encrypt(account.totpSecret);
    account.totpSecret = encrypted.encrypted;
    account.totpSecretIV = encrypted.iv;
    account.totpSecretAuthTag = encrypted.authTag;
};

module.exports = db.define("accounts", {
    firstName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    totpEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    totpSecret: {
        type: Sequelize.STRING,
        defaultValue: () => {
            return speakeasy.generateSecret({ name: "Nexterm" }).base32;
        },
    },
    totpSecretIV: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    totpSecretAuthTag: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    sessionSync: {
        type: Sequelize.STRING,
        defaultValue: "same_browser",
    },
    preferences: {
        type: Sequelize.JSON,
        defaultValue: {},
    },
    avatarHash: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    activeThemeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "themes", key: "id" },
        onDelete: "SET NULL",
    },
}, { 
    freezeTableName: true, 
    createdAt: false, 
    updatedAt: false,
    hooks: {
        beforeCreate: encryptTotpSecret,
        beforeUpdate: (account) => {
            if (account.changed("totpSecret")) encryptTotpSecret(account);
        },
        afterFind: (accounts) => {
            const processAccount = (account) => {
                if (!account) return;

                if (account.preferences && typeof account.preferences === "string") {
                    try {
                        account.preferences = JSON.parse(account.preferences);
                    } catch {
                        account.preferences = {};
                    }
                }

                if (account.totpSecret && account.totpSecretIV && account.totpSecretAuthTag) {
                    try {
                        account.totpSecret = decrypt(account.totpSecret, account.totpSecretIV, account.totpSecretAuthTag);
                    } catch (err) {
                        logger.error("Failed to decrypt TOTP secret", { accountId: account.id, error: err.message });
                    }
                }
            };

            if (Array.isArray(accounts)) {
                accounts.forEach(processAccount);
            } else if (accounts) {
                processAccount(accounts);
            }
        },
    },
});