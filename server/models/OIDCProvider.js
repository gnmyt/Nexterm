const Sequelize = require("sequelize");
const db = require("../utils/database");
const { encrypt, decrypt } = require("../utils/encryption");

module.exports = db.define("oidc_providers", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        issuer: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        clientId: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        clientSecret: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        clientSecretIV: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        clientSecretAuthTag: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        redirectUri: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        scope: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "openid profile email",
        },
        enabled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        emailAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "email",
        },
        firstNameAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "given_name",
        },
        lastNameAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "family_name",
        },
        usernameAttribute: {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: "preferred_username",
        },
        isInternal: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        freezeTableName: true,
        createdAt: false,
        updatedAt: false,
        hooks: {
            beforeCreate: (provider) => {
                if (provider.clientSecret) {
                    const encrypted = encrypt(provider.clientSecret);
                    provider.clientSecret = encrypted.encrypted;
                    provider.clientSecretIV = encrypted.iv;
                    provider.clientSecretAuthTag = encrypted.authTag;
                }
            },
            beforeUpdate: (provider) => {
                if (provider.clientSecret && provider.clientSecret !== "********") {
                    const encrypted = encrypt(provider.clientSecret);
                    provider.clientSecret = encrypted.encrypted;
                    provider.clientSecretIV = encrypted.iv;
                    provider.clientSecretAuthTag = encrypted.authTag;
                }
            },
            afterFind: (providers) => {
                if (!providers) return providers;

                if (Array.isArray(providers)) {
                    providers.forEach(provider => {
                        if (provider.clientSecret) {
                            try {
                                provider.clientSecret = decrypt(
                                    provider.clientSecret,
                                    provider.clientSecretIV,
                                    provider.clientSecretAuthTag,
                                );
                            } catch (error) {
                                console.error(`Failed to decrypt client secret for provider ${provider.id}`);
                            }
                        }
                    });
                } else if (providers.clientSecret) {
                    try {
                        providers.clientSecret = decrypt(
                            providers.clientSecret,
                            providers.clientSecretIV,
                            providers.clientSecretAuthTag,
                        );
                    } catch (error) {
                        console.error(`Failed to decrypt client secret for provider ${providers.id}`);
                    }
                }

                return providers;
            },
        },
    },
);