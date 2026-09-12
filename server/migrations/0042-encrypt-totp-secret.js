const { encrypt } = require("../utils/encryption");
const logger = require("../utils/logger");
const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        if (!process.env.ENCRYPTION_KEY) {
            throw new Error("ENCRYPTION_KEY environment variable is not set. Please set it to run migrations.");
        }

        if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY)) {
            throw new Error("ENCRYPTION_KEY must be a 64-character hexadecimal string.");
        }

        const alreadyMigrated = await queryInterface.describeTable("accounts").then((table) => table.totpSecretAuthTag !== undefined);

        if (alreadyMigrated) {
            logger.info("Migration already applied: totpSecretAuthTag column exists.");
            return;
        }

        await queryInterface.addColumn("accounts", "totpSecretIV", {
            type: DataTypes.STRING,
            allowNull: true,
        });
        await queryInterface.addColumn("accounts", "totpSecretAuthTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        const [accounts] = await queryInterface.sequelize.query("SELECT id, totpSecret FROM accounts");

        for (const account of accounts) {
            if (!account.totpSecret) continue;

            const encrypted = encrypt(account.totpSecret);
            await queryInterface.sequelize.query(
                "UPDATE accounts SET totpSecret = ?, totpSecretIV = ?, totpSecretAuthTag = ? WHERE id = ?",
                { replacements: [encrypted.encrypted, encrypted.iv, encrypted.authTag, account.id] },
            );
            logger.info(`Encrypted TOTP secret for account ${account.id}`);
        }
    },
};
