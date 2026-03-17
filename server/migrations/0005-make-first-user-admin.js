const logger = require("../utils/logger");

module.exports = {
    async up(queryInterface) {
        const [results] = await queryInterface.sequelize.query(
            "SELECT id FROM accounts ORDER BY id ASC LIMIT 1",
        );

        if (results && results.length > 0) {
            const firstUserId = results[0].id;
            await queryInterface.sequelize.query(
                "UPDATE accounts SET role = ? WHERE id = ?",
                { replacements: ["admin", firstUserId] },
            );
            logger.info(`First user ${firstUserId} made admin`);
        } else {
            logger.info("No users found, skipping admin assignment");
        }
    },
};