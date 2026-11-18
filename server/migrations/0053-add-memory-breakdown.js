const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const columns = await queryInterface.describeTable("monitoring_snapshot");

        if (!columns.memory)
            await queryInterface.addColumn("monitoring_snapshot", "memory", { type: DataTypes.JSON, allowNull: true });
    },
};
