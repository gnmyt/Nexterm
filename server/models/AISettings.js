const Sequelize = require("sequelize");
const db = require("../utils/database");

module.exports = db.define("ai_settings", {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    provider: {
        type: Sequelize.ENUM("ollama", "openai"),
        allowNull: true,
    },
    model: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    apiKey: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    apiUrl: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "http://localhost:11434",
    },
    createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
    updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
});
