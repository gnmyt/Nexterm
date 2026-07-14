const Sequelize = require("sequelize");
const db = require("../utils/database");
const logger = require("../utils/logger");
const { decrypt, encrypt } = require("../utils/encryption");

const AISettings = db.define("ai_settings", {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    provider: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    model: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    apiKeyEncrypted: { type: Sequelize.BLOB, allowNull: true },
    apiKeyIV: { type: Sequelize.STRING, allowNull: true },
    apiKeyAuthTag: { type: Sequelize.STRING, allowNull: true },
    oauthAccessTokenEncrypted: { type: Sequelize.BLOB, allowNull: true },
    oauthAccessTokenIV: { type: Sequelize.STRING, allowNull: true },
    oauthAccessTokenAuthTag: { type: Sequelize.STRING, allowNull: true },
    oauthRefreshTokenEncrypted: { type: Sequelize.BLOB, allowNull: true },
    oauthRefreshTokenIV: { type: Sequelize.STRING, allowNull: true },
    oauthRefreshTokenAuthTag: { type: Sequelize.STRING, allowNull: true },
    authMethod: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "api_key",
    },
    oauthProvider: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    oauthAccountId: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    oauthExpiresAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
    },
    oauthVerifier: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    apiUrl: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "http://localhost:11434",
    },
    requireConfirmation: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
    },
    createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
}, {
    hooks: {
        afterFind: (result) => {
            const decryptRow = (row) => {
                if (!row) return;
                try {
                    row.apiKey = decrypt(row.apiKeyEncrypted, row.apiKeyIV, row.apiKeyAuthTag);
                    row.oauthAccessToken = decrypt(row.oauthAccessTokenEncrypted, row.oauthAccessTokenIV, row.oauthAccessTokenAuthTag);
                    row.oauthRefreshToken = decrypt(row.oauthRefreshTokenEncrypted, row.oauthRefreshTokenIV, row.oauthRefreshTokenAuthTag);
                } catch (err) {
                    logger.error("Failed to decrypt AI settings secret", { error: err.message });
                }
            };

            if (Array.isArray(result)) result.forEach(decryptRow);
            else decryptRow(result);
        },
    },
});

const applySecret = (payload, field) => {
    if (!(field in payload)) return;
    const value = payload[field];
    delete payload[field];
    if (value) {
        const enc = encrypt(value);
        payload[`${field}Encrypted`] = Buffer.from(enc.encrypted, "hex");
        payload[`${field}IV`] = enc.iv;
        payload[`${field}AuthTag`] = enc.authTag;
    } else {
        payload[`${field}Encrypted`] = null;
        payload[`${field}IV`] = null;
        payload[`${field}AuthTag`] = null;
    }
};

AISettings.encryptSecrets = (values) => {
    const payload = { ...values };
    applySecret(payload, "apiKey");
    applySecret(payload, "oauthAccessToken");
    applySecret(payload, "oauthRefreshToken");
    return payload;
};

AISettings.getOrCreate = async () => {
    let settings = await AISettings.findOne();
    if (!settings) settings = await AISettings.create({});
    return settings;
};

module.exports = AISettings;
