const { Op } = require("sequelize");
const PermissionGroup = require("../models/PermissionGroup");
const GroupMember = require("../models/GroupMember");
const GroupPermission = require("../models/GroupPermission");
const AccountPermission = require("../models/AccountPermission");
const Account = require("../models/Account");
const OrganizationMember = require("../models/OrganizationMember");
const OrganizationMemberPermission = require("../models/OrganizationMemberPermission");
const sequelize = require("../utils/database");
const registry = require("../permissions/registry");
const { getSystemPermissions, getOrganizationPermissions } = require("../permissions/engine");
const { getAdminGroupIds, countAdmins, isAccountAdmin } = require("../utils/permission");
const logger = require("../utils/logger");

const TRI = ["allow", "deny", "neutral"];

const isBuiltIn = (group) => group.isAdmin || group.isDefault;

const grantsBeyondCaller = (caller, permissions) =>
    !caller?.isAdmin && Object.entries(permissions || {})
        .some(([permission, value]) => value === "allow" && !caller?.permissions?.includes(permission));

const ADMIN_GROUP_FORBIDDEN = { code: 403, message: "Only administrators can manage the administrator group" };
const GRANT_FORBIDDEN = { code: 403, message: "You can only grant permissions that you hold yourself" };

const userView = (account) => ({
    id: account.id, username: account.username,
    firstName: account.firstName, lastName: account.lastName,
});

const applyTriState = async (Model, scope, baseWhere, permissions) => {
    for (const [permission, value] of Object.entries(permissions || {})) {
        if (!registry.isValidPermission(scope, permission)) continue;
        if (!TRI.includes(value)) continue;

        const where = { ...baseWhere, permission };
        if (value === "neutral") {
            await Model.destroy({ where });
        } else {
            const [row, created] = await Model.findOrCreate({ where, defaults: { value } });
            if (!created && row.value !== value) await Model.update({ value }, { where });
        }
    }
};

module.exports.getCatalog = () => ({
    system: registry.buildCatalog(registry.SCOPES.SYSTEM),
    organization: registry.buildCatalog(registry.SCOPES.ORGANIZATION),
});

module.exports.listGroups = async () => {
    const groups = await PermissionGroup.findAll({ order: [["sortOrder", "ASC"], ["id", "ASC"]] });
    const [permissions, members] = await Promise.all([
        GroupPermission.findAll(),
        GroupMember.findAll(),
    ]);

    return groups.map((group) => ({
        ...group,
        isSystem: isBuiltIn(group),
        memberCount: members.filter((m) => m.groupId === group.id).length,
        permissions: permissions
            .filter((p) => p.groupId === group.id)
            .reduce((acc, p) => ({ ...acc, [p.permission]: p.value }), {}),
    }));
};

module.exports.reorderGroups = async (orderedIds) => {
    const groups = await PermissionGroup.findAll();
    const reorderable = new Set(groups.filter((g) => !g.isAdmin && !g.isDefault).map((g) => g.id));
    const ordered = orderedIds.filter((id) => reorderable.has(id));

    await sequelize.transaction((transaction) =>
        Promise.all(ordered.map((id, index) =>
            PermissionGroup.update({ sortOrder: index + 1 }, { where: { id }, transaction }))));

    return module.exports.listGroups();
};

module.exports.getGroup = async (groupId) => {
    const group = await PermissionGroup.findByPk(groupId);
    if (!group) return { code: 404, message: "Group not found" };

    const [permissions, members] = await Promise.all([
        GroupPermission.findAll({ where: { groupId } }),
        GroupMember.findAll({ where: { groupId } }),
    ]);

    const accounts = await Account.findAll({
        where: { id: { [Op.in]: members.map((m) => m.accountId) } },
        attributes: ["id", "username", "firstName", "lastName"],
    });

    return {
        ...group,
        isSystem: isBuiltIn(group),
        permissions: permissions.reduce((acc, p) => ({ ...acc, [p.permission]: p.value }), {}),
        members: accounts.map(userView),
    };
};

module.exports.createGroup = async ({ name, color }) => {
    const group = await PermissionGroup.create({
        name: name.trim(),
        color: color || "#314BD3",
        sortOrder: ((await PermissionGroup.max("sortOrder")) || 0) + 1,
    });
    logger.system(`Permission group created`, { groupId: group.id, name: group.name });
    return group;
};

module.exports.updateGroup = async (groupId, { name, color, sortOrder }) => {
    const group = await PermissionGroup.findByPk(groupId);
    if (!group) return { code: 404, message: "Group not found" };
    if (isBuiltIn(group)) return { code: 400, message: "Built-in groups cannot be modified" };

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    await PermissionGroup.update(updates, { where: { id: groupId } });
    return await PermissionGroup.findByPk(groupId);
};

module.exports.deleteGroup = async (groupId) => {
    const group = await PermissionGroup.findByPk(groupId);
    if (!group) return { code: 404, message: "Group not found" };
    if (isBuiltIn(group)) return { code: 400, message: "Built-in groups cannot be deleted" };

    await GroupPermission.destroy({ where: { groupId } });
    await GroupMember.destroy({ where: { groupId } });
    await PermissionGroup.destroy({ where: { id: groupId } });

    logger.system(`Permission group deleted`, { groupId, name: group.name });
    return { success: true };
};

module.exports.setGroupPermissions = async (groupId, permissions, caller) => {
    const group = await PermissionGroup.findByPk(groupId);
    if (!group) return { code: 404, message: "Group not found" };
    if (group.isAdmin) return { code: 400, message: "The administrator group already grants every permission" };
    if (grantsBeyondCaller(caller, permissions)) return GRANT_FORBIDDEN;

    await applyTriState(GroupPermission, registry.SCOPES.SYSTEM, { groupId }, permissions);
    return await module.exports.getGroup(groupId);
};

module.exports.addGroupMember = async (groupId, accountId, caller) => {
    const group = await PermissionGroup.findByPk(groupId);
    if (!group) return { code: 404, message: "Group not found" };
    if (group.isAdmin && !caller?.isAdmin) return ADMIN_GROUP_FORBIDDEN;

    const account = await Account.findByPk(accountId);
    if (!account) return { code: 404, message: "Account not found" };

    await GroupMember.findOrCreate({ where: { groupId, accountId } });
    return { success: true };
};

module.exports.removeGroupMember = async (groupId, accountId, caller) => {
    const group = await PermissionGroup.findByPk(groupId);
    if (!group) return { code: 404, message: "Group not found" };
    if (group.isAdmin && !caller?.isAdmin) return ADMIN_GROUP_FORBIDDEN;

    if (group.isAdmin && (await countAdmins()) <= 1)
        return { code: 400, message: "You cannot remove the last administrator" };

    await GroupMember.destroy({ where: { groupId, accountId } });
    return { success: true };
};

module.exports.getUserPermissions = async (accountId) => {
    const account = await Account.findByPk(accountId);
    if (!account) return { code: 404, message: "Account not found" };

    const [memberships, overrides, effective] = await Promise.all([
        GroupMember.findAll({ where: { accountId } }),
        AccountPermission.findAll({ where: { accountId } }),
        getSystemPermissions(accountId),
    ]);

    return {
        ...userView(account),
        groupIds: memberships.map((m) => m.groupId),
        overrides: overrides.reduce((acc, o) => ({ ...acc, [o.permission]: o.value }), {}),
        effective,
    };
};

module.exports.setUserGroups = async (accountId, groupIds, caller) => {
    const account = await Account.findByPk(accountId);
    if (!account) return { code: 404, message: "Account not found" };

    const groups = await PermissionGroup.findAll({ where: { id: { [Op.in]: groupIds } } });
    const validIds = new Set(groups.map((g) => g.id));
    const keepIds = groupIds.filter((id) => validIds.has(id));

    const adminGroupIds = await getAdminGroupIds();
    const willBeAdmin = keepIds.some((id) => adminGroupIds.includes(id));

    if (!caller?.isAdmin && (willBeAdmin || (await isAccountAdmin(accountId)))) return ADMIN_GROUP_FORBIDDEN;

    if (!willBeAdmin && (await isAccountAdmin(accountId)) && (await countAdmins()) <= 1)
        return { code: 400, message: "You cannot remove the last administrator" };

    await sequelize.transaction(async (transaction) => {
        await GroupMember.destroy({ where: { accountId }, transaction });
        if (keepIds.length)
            await GroupMember.bulkCreate(keepIds.map((groupId) => ({ groupId, accountId })), { transaction });
    });

    return await module.exports.getUserPermissions(accountId);
};

module.exports.setUserPermissions = async (accountId, permissions, caller) => {
    const account = await Account.findByPk(accountId);
    if (!account) return { code: 404, message: "Account not found" };
    if (grantsBeyondCaller(caller, permissions)) return GRANT_FORBIDDEN;

    await applyTriState(AccountPermission, registry.SCOPES.SYSTEM, { accountId }, permissions);
    return await module.exports.getUserPermissions(accountId);
};

module.exports.getOrgMemberPermissions = async (organizationId, accountId) => {
    const [overrides, effective, account] = await Promise.all([
        OrganizationMemberPermission.findAll({ where: { organizationId, accountId } }),
        getOrganizationPermissions(accountId, organizationId),
        getSystemPermissions(accountId),
    ]);

    const orgIds = new Set(registry.allOrgIds());
    const inherited = account.isAdmin ? [...orgIds] : account.permissions.filter((id) => orgIds.has(id));

    return {
        catalog: registry.buildCatalog(registry.SCOPES.ORGANIZATION),
        overrides: overrides.reduce((acc, o) => ({ ...acc, [o.permission]: o.value }), {}),
        effective,
        inherited,
    };
};

module.exports.setOrgMemberPermissions = async (organizationId, accountId, permissions, caller) => {
    const member = await OrganizationMember.findOne({ where: { organizationId, accountId, status: "active" } });
    if (!member) return { code: 404, message: "Member not found" };

    const unrestricted = caller?.isOwner || caller?.isAdmin;
    if (!unrestricted && Object.entries(permissions || {})
        .some(([permission, value]) => value === "allow" && !caller?.permissions?.includes(permission)))
        return GRANT_FORBIDDEN;

    await applyTriState(OrganizationMemberPermission, registry.SCOPES.ORGANIZATION, { organizationId, accountId }, permissions);
    return await module.exports.getOrgMemberPermissions(organizationId, accountId);
};
