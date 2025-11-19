const Sequelize = require("sequelize");
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
    serverEntryId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: "entries",
            key: "id",
        },
        onDelete: "CASCADE",
    },
    type: {
        type: Sequelize.STRING,
        allowNull: false,
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
        beforeCreate: (credential) => {
            if (credential.secret) {
                const encrypted = encrypt(credential.secret);
                credential.secretEncrypted = encrypted.encrypted;
                credential.secretIV = encrypted.iv;
                credential.secretAuthTag = encrypted.authTag;
            }
        },
        beforeUpdate: (credential) => {
            if (credential.secret && credential.changed('secret')) {
                const encrypted = encrypt(credential.secret);
                credential.secretEncrypted = encrypted.encrypted;
                credential.secretIV = encrypted.iv;
                credential.secretAuthTag = encrypted.authTag;
            }
        },
        afterFind: (credentials) => {
            const decryptField = (obj) => {
                if (obj.secretEncrypted) {
                    try {
                        obj.secret = decrypt(obj.secretEncrypted, obj.secretIV, obj.secretAuthTag);
                    } catch (err) {
                        console.error(`Failed to decrypt secret for credential ${obj.id}`);
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
