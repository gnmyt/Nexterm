const { DataTypes } = require("sequelize");
const logger = require('../utils/logger');


module.exports = {
    async up(queryInterface) {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes("organization_members")) {
            logger.info("Table organization_members does not exist, skipping migration");
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
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        }, {
            freezeTableName: true,
        });

        await queryInterface.sequelize.query(`
            INSERT INTO organization_members(organizationId, accountId, role, status, invitedBy, createdAt, updatedAt)
            SELECT DISTINCT organizationId, accountId, role, status, invitedBy, 
                   COALESCE(createdAt, datetime('now')) as createdAt,
                   COALESCE(updatedAt, datetime('now')) as updatedAt
            FROM organization_members_backup
            GROUP BY organizationId, accountId
            HAVING MIN(rowid)
        `);

        await queryInterface.sequelize.query("DROP TABLE organization_members_backup");
    },
};
