const Sequelize = require("sequelize");
const db = require("../utils/database");
const speakeasy = require("speakeasy");

module.exports = db.define("accounts", {
    firstName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    totpEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    totpSecret: {
        type: Sequelize.STRING,
        defaultValue: () => {
            return speakeasy.generateSecret({ name: "Nexterm" }).base32;
        },
    },
    sessionSync: {
        type: Sequelize.STRING,
        defaultValue: "same_browser",
    },
    preferences: {
        type: Sequelize.JSON,
        defaultValue: {},
    },
    oidcGroups: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
    },
    idpSubject: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    avatarHash: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    activeThemeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "themes", key: "id" },
        onDelete: "SET NULL",
    },
}, { 
    freezeTableName: true, 
    createdAt: false, 
    updatedAt: false,
    hooks: {
        afterFind: (accounts) => {
            const parseJsonField = (account, field, fallback) => {
                if (account && typeof account[field] === "string") {
                    try {
                        account[field] = JSON.parse(account[field]);
                    } catch {
                        account[field] = fallback;
                    }
                }
            };
            const parsePreferences = (account) => {
                parseJsonField(account, "preferences", {});
                parseJsonField(account, "oidcGroups", []);
            };
            
            if (Array.isArray(accounts)) {
                accounts.forEach(parsePreferences);
            } else if (accounts) {
                parsePreferences(accounts);
            }
        },
    },
});