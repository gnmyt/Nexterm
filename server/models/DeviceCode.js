const Sequelize = require("sequelize");
const db = require("../utils/database");
const crypto = require("crypto");

const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const generateCode = () => {
    let code = "";
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += "-";
        code += CODE_CHARSET[crypto.randomInt(CODE_CHARSET.length)];
    }
    return code;
};

module.exports = db.define("device_codes", {
    code: {
        type: Sequelize.STRING(9),
        allowNull: false,
        unique: true,
        defaultValue: generateCode,
    },
    token: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        defaultValue: () => crypto.randomBytes(32).toString("hex"),
    },
    sessionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    ipAddress: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    userAgent: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    clientType: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
    },
}, { freezeTableName: true, updatedAt: false });

module.exports.generateCode = generateCode;
