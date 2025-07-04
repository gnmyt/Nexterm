const { DataTypes } = require("sequelize");


module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("organization_members")) {
            console.log("Table organization_members does not exist, skipping migration");
            return;
        }

        await queryInterface.sequelize.query(`CREATE TABLE organization_members_backup AS
        SELECT *
        FROM organization_members`);

        await queryInterface.dropTable("organization_members");

        await queryInterface.createTable("organization_members", {
            organizationId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
            },
            accountId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
            },
            role: {
                type: DataTypes.ENUM("owner", "member"),
                defaultValue: "member",
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM("pending", "active"),
                defaultValue: "pending",
                allowNull: false,
            },
            invitedBy: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        }, {
            freezeTableName: true,
        });

        await queryInterface.sequelize.query(`
            INSERT INTO organization_members(organizationId, accountId, role, status, invitedBy)
            SELECT DISTINCT organizationId, accountId, role, status, invitedBy
            FROM organization_members_backup
            GROUP BY organizationId, accountId
            HAVING MIN(rowid)
        `);

        await queryInterface.sequelize.query("DROP TABLE organization_members_backup");

        console.log("Successfully updated organization_members table with composite primary key");
    },
};
