const { encrypt } = require("../utils/encryption");
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

        await queryInterface.addColumn("identities", "passwordIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn("identities", "passwordAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn("identities", "sshKeyIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn("identities", "sshKeyAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn("identities", "passphraseIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn("identities", "passphraseAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        const [identities] = await queryInterface.sequelize.query(
            "SELECT * FROM identities"
        );

        for (const identity of identities) {
            const updates = [];
            const values = [];

            const encryptField = (field) => {
                if (identity[field] && !identity[`${field}IV`] && !identity[`${field}AuthTag`]) {
                    const encrypted = encrypt(identity[field]);
                    updates.push(`${field} = ?`, `${field}IV = ?`, `${field}AuthTag = ?`);
                    values.push(encrypted.encrypted, encrypted.iv, encrypted.authTag);
                }
            };

            encryptField("password");
            encryptField("sshKey");
            encryptField("passphrase");

            if (updates.length > 0) {
                values.push(identity.id);
                await queryInterface.sequelize.query(
                    `UPDATE identities SET ${updates.join(", ")} WHERE id = ?`,
                    { replacements: values }
                );
                console.log(`Encrypted identity ${identity.id}`);
            }
        }
    },
};