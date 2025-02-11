const Sequelize = require("sequelize");
const db = require("../utils/database");
const { encrypt, decrypt } = require("../utils/encryption");

module.exports = db.define(
    "identities",
    {
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        accountId: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        username: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        type: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        password: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        passwordIV: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        passwordAuthTag: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        sshKey: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        sshKeyIV: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        sshKeyAuthTag: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        passphrase: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        passphraseIV: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        passphraseAuthTag: {
            type: Sequelize.STRING,
            allowNull: true,
        },
    },
    {
        freezeTableName: true,
        createdAt: false,
        updatedAt: false,
        hooks: {
            beforeCreate: (identity) => {
                if (identity.password) {
                    const encrypted = encrypt(identity.password);
                    identity.password = encrypted.encrypted;
                    identity.passwordIV = encrypted.iv;
                    identity.passwordAuthTag = encrypted.authTag;
                }
                if (identity.sshKey) {
                    const encrypted = encrypt(identity.sshKey);
                    identity.sshKey = encrypted.encrypted;
                    identity.sshKeyIV = encrypted.iv;
                    identity.sshKeyAuthTag = encrypted.authTag;
                }
                if (identity.passphrase) {
                    const encrypted = encrypt(identity.passphrase);
                    identity.passphrase = encrypted.encrypted;
                    identity.passphraseIV = encrypted.iv;
                    identity.passphraseAuthTag = encrypted.authTag;
                }
            },
            beforeUpdate: (identity) => {
                if (identity.password && identity.password !== "********") {
                    const encrypted = encrypt(identity.password);
                    identity.password = encrypted.encrypted;
                    identity.passwordIV = encrypted.iv;
                    identity.passwordAuthTag = encrypted.authTag;
                }
                if (identity.sshKey) {
                    const encrypted = encrypt(identity.sshKey);
                    identity.sshKey = encrypted.encrypted;
                    identity.sshKeyIV = encrypted.iv;
                    identity.sshKeyAuthTag = encrypted.authTag;
                }
                if (identity.passphrase && identity.passphrase !== "********") {
                    const encrypted = encrypt(identity.passphrase);
                    identity.passphrase = encrypted.encrypted;
                    identity.passphraseIV = encrypted.iv;
                    identity.passphraseAuthTag = encrypted.authTag;
                }
            },
            afterFind: (identities) => {
                const decryptField = (obj, field) => {
                    if (obj[field]) {
                        obj[field] = decrypt(
                            obj[field],
                            obj[`${field}IV`],
                            obj[`${field}AuthTag`]
                        );
                    }
                };

                if (Array.isArray(identities)) {
                    identities.forEach((identity) => {
                        decryptField(identity, "password");
                        decryptField(identity, "sshKey");
                        decryptField(identity, "passphrase");
                    });
                } else if (identities) {
                    decryptField(identities, "password");
                    decryptField(identities, "sshKey");
                    decryptField(identities, "passphrase");
                }
            },
        },
    }
);
