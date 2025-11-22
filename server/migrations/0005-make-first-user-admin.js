const Account = require("../models/Account");
const logger = require('../utils/logger');
const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const firstUser = await Account.findOne({ order: [["id", "ASC"]] });
        if (firstUser) {
            await Account.update(
                { role: "admin" },
                { where: { id: firstUser.id } },
            );
            logger.info(`First user ${firstUser.id} made admin`);
        } else {
            logger.info("No users found, skipping admin assignment");
        }
    },
};