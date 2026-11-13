const Sequelize = require("sequelize");
const db = require("../utils/database");
const { decrypt, encrypt } = require("../utils/encryption");
const logger = require("../utils/logger");

const parseJson = (value, fallback) => {
    if (Array.isArray(value) || (value && typeof value === "object")) return value;
    if (typeof value !== "string" || !value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

module.exports = db.define("ssh_certificate_authorities", {
    organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
    },
    name: { type: Sequelize.STRING, allowNull: false },
    backend: { type: Sequelize.STRING, allowNull: false },
    enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    ttlSeconds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 300 },
    sourceAddress: { type: Sequelize.STRING, allowNull: true },
    extraPrincipals: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    groupPrincipalMappings: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    selectorGroups: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    domains: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    environments: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    ttlByGroup: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    ttlByEnvironment: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
    keyIdTemplate: { type: Sequelize.STRING, allowNull: false, defaultValue: "{{username}}" },
    config: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
    secret: { type: Sequelize.VIRTUAL, allowNull: true },
    secretEncrypted: { type: Sequelize.BLOB, allowNull: true },
    secretIV: { type: Sequelize.STRING, allowNull: true },
    secretAuthTag: { type: Sequelize.STRING, allowNull: true },
}, {
    freezeTableName: true,
    timestamps: true,
    hooks: {
        beforeValidate: (authority) => {
            if (authority.secret && !authority.secretEncrypted) {
                const encrypted = encrypt(authority.secret);
                authority.setDataValue("secretEncrypted", Buffer.from(encrypted.encrypted, "hex"));
                authority.setDataValue("secretIV", encrypted.iv);
                authority.setDataValue("secretAuthTag", encrypted.authTag);
            }
        },
        beforeUpdate: (authority) => {
            if (authority.secret && authority.changed("secret")) {
                const encrypted = encrypt(authority.secret);
                authority.setDataValue("secretEncrypted", Buffer.from(encrypted.encrypted, "hex"));
                authority.setDataValue("secretIV", encrypted.iv);
                authority.setDataValue("secretAuthTag", encrypted.authTag);
            }
        },
        afterFind: (authorities) => {
            const hydrate = (authority) => {
                if (!authority) return;
                authority.extraPrincipals = parseJson(authority.extraPrincipals, []);
                authority.groupPrincipalMappings = parseJson(authority.groupPrincipalMappings, []);
                authority.selectorGroups = parseJson(authority.selectorGroups, []);
                authority.domains = parseJson(authority.domains, []);
                authority.environments = parseJson(authority.environments, []);
                authority.ttlByGroup = parseJson(authority.ttlByGroup, []);
                authority.ttlByEnvironment = parseJson(authority.ttlByEnvironment, []);
                authority.config = parseJson(authority.config, {});
                if (!authority.secretEncrypted) return;
                try {
                    authority.secret = decrypt(authority.secretEncrypted, authority.secretIV, authority.secretAuthTag);
                } catch (error) {
                    logger.error("Failed to decrypt SSH certificate authority secret", { id: authority.id, error: error.message });
                }
            };
            if (Array.isArray(authorities)) authorities.forEach(hydrate);
            else hydrate(authorities);
        },
    },
});
