const Sequelize = require("sequelize");
const logger = require("../utils/logger");
const db = require("../utils/database");
const { decrypt, encrypt } = require("../utils/encryption");

module.exports = db.define("credentials", {
    identityId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "identities",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    integrationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "integrations",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    secret: {
        type: Sequelize.VIRTUAL,
        allowNull: true,
    },
    secretEncrypted: {
        type: Sequelize.BLOB,
        allowNull: false,
    },
    secretIV: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    secretAuthTag: {
        type: Sequelize.STRING,
        allowNull: true,
    },
}, { 
    freezeTableName: true,
    timestamps: true,
    hooks: {
        beforeValidate: (credential) => {
            if (credential.secret && !credential.secretEncrypted) {
                const encrypted = encrypt(credential.secret);
                credential.setDataValue('secretEncrypted', Buffer.from(encrypted.encrypted, 'hex'));
                credential.setDataValue('secretIV', encrypted.iv);
                credential.setDataValue('secretAuthTag', encrypted.authTag);
            }
        },
        beforeUpdate: (credential) => {
            if (credential.secret && credential.changed('secret')) {
                const encrypted = encrypt(credential.secret);
                credential.setDataValue('secretEncrypted', Buffer.from(encrypted.encrypted, 'hex'));
                credential.setDataValue('secretIV', encrypted.iv);
                credential.setDataValue('secretAuthTag', encrypted.authTag);
            }
        },
        afterFind: (credentials) => {
            const decryptField = (obj) => {
                if (obj.secretEncrypted) {
                    try {
                        obj.secret = decrypt(obj.secretEncrypted, obj.secretIV, obj.secretAuthTag);
                    } catch (err) {
                        logger.error("Failed to decrypt secret for credential", { credentialId: obj.id, error: err.message });
                    }
                }
            };

            if (Array.isArray(credentials)) {
                credentials.forEach((credential) => {
                    decryptField(credential);
                });
            } else if (credentials) {
                decryptField(credentials);
            }
        },
    },
});
