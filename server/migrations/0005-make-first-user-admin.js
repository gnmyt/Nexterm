const Account = require("../models/Account");
const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const firstUser = await Account.findOne({ order: [["id", "ASC"]] });
        if (firstUser) {
            await Account.update(
                { role: "admin" },
                { where: { id: firstUser.id } },
            );
            console.log(`First user ${firstUser.id} made admin`);
        } else {
            console.log("No users found, skipping admin assignment");
        }
    },
};