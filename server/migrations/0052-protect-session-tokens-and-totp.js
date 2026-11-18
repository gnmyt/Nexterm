const crypto = require("crypto");
const { DataTypes } = require("sequelize");
const { encrypt } = require("../utils/encryption");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const setForeignKeyChecks = (queryInterface, enabled) =>
    queryInterface.sequelize.query(queryInterface.sequelize.options.dialect === "mysql"
        ? `SET FOREIGN_KEY_CHECKS = ${enabled ? 1 : 0}`
        : `PRAGMA foreign_keys = ${enabled ? "ON" : "OFF"}`);

module.exports = {
    async up(queryInterface) {
        const select = (sql) => queryInterface.sequelize.query(sql, { type: queryInterface.sequelize.QueryTypes.SELECT });

        await setForeignKeyChecks(queryInterface, false);
        try {
            const sessionColumns = await queryInterface.describeTable("sessions");
            if (!sessionColumns.tokenHash)
                await queryInterface.addColumn("sessions", "tokenHash", { type: DataTypes.STRING(64), allowNull: true });

            if (sessionColumns.token) {
                for (const session of await select("SELECT id, token FROM sessions WHERE token IS NOT NULL")) {
                    await queryInterface.sequelize.query("UPDATE sessions SET tokenHash = :hash WHERE id = :id",
                        { replacements: { hash: hashToken(session.token), id: session.id } });
                }
                await queryInterface.sequelize.query("DELETE FROM sessions WHERE tokenHash IS NULL");
                await queryInterface.removeColumn("sessions", "token");
            }
            await queryInterface.addIndex("sessions", ["tokenHash"], { name: "sessions_token_hash", unique: true });

            const accountColumns = await queryInterface.describeTable("accounts");
            for (const column of ["totpSecretEncrypted", "totpSecretIV", "totpSecretAuthTag"]) {
                if (!accountColumns[column])
                    await queryInterface.addColumn("accounts", column, { type: DataTypes.TEXT, allowNull: true });
            }

            if (accountColumns.totpSecret) {
                for (const account of await select("SELECT id, totpSecret FROM accounts WHERE totpEnabled = 1 AND totpSecret IS NOT NULL")) {
                    const sealed = encrypt(account.totpSecret);
                    await queryInterface.sequelize.query(
                        "UPDATE accounts SET totpSecretEncrypted = :encrypted, totpSecretIV = :iv, totpSecretAuthTag = :authTag WHERE id = :id",
                        { replacements: { ...sealed, id: account.id } });
                }
                await queryInterface.removeColumn("accounts", "totpSecret");
            }
        } finally {
            await setForeignKeyChecks(queryInterface, true);
        }
    },
};
