const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("folder_identity_profiles", {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
    folderId: { type: Sequelize.INTEGER, allowNull: false, references: { model: "folders", key: "id" }, onDelete: "CASCADE" },
    protocol: { type: Sequelize.STRING, allowNull: false },
    identityId: { type: Sequelize.INTEGER, allowNull: false, references: { model: "identities", key: "id" }, onDelete: "CASCADE" },
    accountId: { type: Sequelize.INTEGER, allowNull: true, references: { model: "accounts", key: "id" }, onDelete: "CASCADE" },
    position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
}, { freezeTableName: true, timestamps: true, createdAt: true, updatedAt: false });
