const { encrypt } = require("../utils/encryption");
const Identity = require("../models/Identity");
const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        if (!process.env.ENCRYPTION_KEY) {
            throw new Error("ENCRYPTION_KEY environment variable is not set. Please set it to run migrations.");
        }

        if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
            throw new Error("ENCRYPTION_KEY must be a 64-character hexadecimal string.");
        }
        const authTagExists = await queryInterface.describeTable("identities").then((table) => table.passwordAuthTag !== undefined);

        if (authTagExists) {
            console.log("Migration already applied: passwordAuthTag column exists.");
            return;
        }

        queryInterface.addColumn("identities", "passwordIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        queryInterface.addColumn("identities", "passwordAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        queryInterface.addColumn("identities", "sshKeyIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        queryInterface.addColumn("identities", "sshKeyAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        queryInterface.addColumn("identities", "passphraseIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        queryInterface.addColumn("identities", "passphraseAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        const identities = await Identity.findAll({ hooks: false });

        for (const identity of identities) {
            const updates = {};

            const encryptField = (field) => {
                if (identity[field] && !identity[`${field}IV`] && !identity[`${field}AuthTag`]) {
                    const encrypted = encrypt(identity[field]);
                    updates[field] = encrypted.encrypted;
                    updates[`${field}IV`] = encrypted.iv;
                    updates[`${field}AuthTag`] = encrypted.authTag;
                }
            };

            encryptField("password");
            encryptField("sshKey");
            encryptField("passphrase");

            if (Object.keys(updates).length > 0) {
                await Identity.update(updates, { where: { id: identity.id } });
                console.log(`Encrypted identity ${identity.id}`);
            }
        }
    },
};