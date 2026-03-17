const { decrypt } = require("../utils/encryption");
const { encrypt } = require("../utils/encryption");

module.exports = {
    async up(queryInterface, Sequelize) {
        const { STRING } = Sequelize;

        await queryInterface.createTable("backup_providers", {
            id: { type: STRING, primaryKey: true },
            name: { type: STRING, allowNull: false },
            type: { type: STRING, allowNull: false },
            path: { type: STRING, allowNull: true },
            url: { type: STRING, allowNull: true },
            folder: { type: STRING, allowNull: true },
            username: { type: STRING, allowNull: true },
            password: { type: STRING, allowNull: true },
            passwordIV: { type: STRING, allowNull: true },
            passwordAuthTag: { type: STRING, allowNull: true },
            share: { type: STRING, allowNull: true },
            domain: { type: STRING, allowNull: true },
        });

        const [settings] = await queryInterface.sequelize.query(
            "SELECT id, providers FROM backup_settings LIMIT 1"
        );

        if (settings.length > 0 && settings[0].providers) {
            let providers = [];
            try {
                providers = JSON.parse(settings[0].providers);
            } catch {
                providers = [];
            }

            for (const provider of providers) {
                const config = provider.config || {};
                
                let password = null, passwordIV = null, passwordAuthTag = null;
                if (config.passwordEncrypted) {
                    try {
                        const decrypted = decrypt(config.passwordEncrypted, config.passwordIV, config.passwordAuthTag);
                        const encrypted = encrypt(decrypted);
                        password = encrypted.encrypted;
                        passwordIV = encrypted.iv;
                        passwordAuthTag = encrypted.authTag;
                    } catch {
                    }
                }

                await queryInterface.bulkInsert("backup_providers", [{
                    id: provider.id,
                    name: provider.name,
                    type: provider.type,
                    path: config.path || null,
                    url: config.url || null,
                    folder: config.folder || null,
                    username: config.username || null,
                    password,
                    passwordIV,
                    passwordAuthTag,
                    share: config.share || null,
                    domain: config.domain || null,
                }]);
            }
        }

        await queryInterface.removeColumn("backup_settings", "providers");
    },
};
