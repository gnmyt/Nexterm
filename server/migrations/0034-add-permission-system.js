const logger = require("../utils/logger");
const registry = require("../permissions/registry");

module.exports = {
    async up(queryInterface, DataTypes) {
        const isSqlite = queryInterface.sequelize.getDialect() === "sqlite";
        const triState = {
            type: DataTypes.ENUM("allow", "deny"),
            allowNull: false,
            defaultValue: "allow",
        };

        await queryInterface.createTable("permission_groups", {
            id: { type: DataTypes.INTEGER, autoIncrement: true, allowNull: false, primaryKey: true },
            name: { type: DataTypes.STRING, allowNull: false },
            color: { type: DataTypes.STRING, allowNull: false, defaultValue: "#314BD3" },
            isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            isAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        });

        await queryInterface.createTable("group_members", {
            groupId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            accountId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        });

        await queryInterface.createTable("group_permissions", {
            groupId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            permission: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
            value: triState,
        });

        await queryInterface.createTable("account_permissions", {
            accountId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            permission: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
            value: triState,
        });

        await queryInterface.createTable("organization_member_permissions", {
            organizationId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            accountId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            permission: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
            value: triState,
        });

        await queryInterface.bulkInsert("permission_groups", [{
            name: "Administrator", color: registry.ADMIN_COLOR, isDefault: false, isAdmin: true, sortOrder: 0,
        }]);
        const [[adminGroup]] = await queryInterface.sequelize.query(
            "SELECT id FROM permission_groups WHERE isAdmin = 1 ORDER BY id ASC LIMIT 1",
        );

        await queryInterface.bulkInsert("permission_groups", [{
            name: "Default", color: "#B7B7B7", isDefault: true, isAdmin: false, sortOrder: 1,
        }]);
        const [[defaultGroup]] = await queryInterface.sequelize.query(
            "SELECT id FROM permission_groups WHERE isDefault = 1 ORDER BY id ASC LIMIT 1",
        );

        const defaultPermissions = registry.getDefaultPermissions(registry.SCOPES.SYSTEM);
        if (defaultGroup && defaultPermissions.length) {
            await queryInterface.bulkInsert("group_permissions", defaultPermissions.map((permission) => ({
                groupId: defaultGroup.id, permission, value: "allow",
            })));
        }

        const [admins] = await queryInterface.sequelize.query(
            "SELECT id FROM accounts WHERE role = 'admin'",
        );
        if (adminGroup && admins.length) {
            await queryInterface.bulkInsert("group_members", admins.map((a) => ({
                groupId: adminGroup.id, accountId: a.id,
            })));
            logger.info(`Migrated ${admins.length} admin account(s) into the Administrator group`);
        }

        if (isSqlite) await queryInterface.sequelize.query("PRAGMA foreign_keys = OFF");
        await queryInterface.removeColumn("accounts", "role");
        if (isSqlite) await queryInterface.sequelize.query("PRAGMA foreign_keys = ON");

        logger.info("Permission system installed and legacy role column removed");
    },
};
