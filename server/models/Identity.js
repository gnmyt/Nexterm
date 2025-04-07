const Sequelize = require("sequelize");
const db = require("../utils/database");
const { decrypt } = require("../utils/encryption");

module.exports = db.define(
    "identities",
    {
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        accountId: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        organizationId: {
            type: Sequelize.INTEGER,
            allowNull: true
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
            afterFind: (identities) => {
                const decryptField = (obj, field) => {
                    if (obj[field]) {
                        try {
                            obj[field] = decrypt(obj[field], obj[`${field}IV`], obj[`${field}AuthTag`]);
                        } catch (err) {
                            console.error(`Failed to decrypt ${field} for identity ${obj.id}`);
                        }
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
