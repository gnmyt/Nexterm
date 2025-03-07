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
            afterFind: (identities) => {
                const decryptField = (obj, field) => {
                    if (obj[field]) {
                        obj[field] = decrypt(obj[field], obj[`${field}IV`], obj[`${field}AuthTag`]);
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
