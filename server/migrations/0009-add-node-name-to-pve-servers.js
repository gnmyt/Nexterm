const { DataTypes } = require("sequelize");

module.exports = {
    async up(queryInterface) {
        const tableInfo = await queryInterface.describeTable("pve_servers");
        
        if (!tableInfo.nodeName) {
            await queryInterface.addColumn("pve_servers", "nodeName", {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null,
            });
        }
    }
};
