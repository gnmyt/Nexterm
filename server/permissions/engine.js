const { Op } = require("sequelize");
const PermissionGroup = require("../models/PermissionGroup");
const GroupMember = require("../models/GroupMember");
const GroupPermission = require("../models/GroupPermission");
const AccountPermission = require("../models/AccountPermission");
const OrganizationMember = require("../models/OrganizationMember");
const OrganizationMemberPermission = require("../models/OrganizationMemberPermission");
const registry = require("./registry");

const { ADMIN_WILDCARD, Permission } = registry;

const getGroupsForAccount = async (accountId) => {
    const [memberships, groups] = await Promise.all([
        GroupMember.findAll({ where: { accountId } }),
        PermissionGroup.findAll(),
    ]);

    const memberGroupIds = new Set(memberships.map((m) => m.groupId));
    return groups.filter((g) => memberGroupIds.has(g.id) || g.isDefault);
};

const byPriority = (a, b) =>
    a.isDefault === b.isDefault ? a.sortOrder - b.sortOrder || a.id - b.id : a.isDefault ? 1 : -1;

const getSystemPermissions = async (accountId) => {
    if (!accountId) return { isAdmin: false, permissions: [] };

    const groups = await getGroupsForAccount(accountId);
    if (groups.some((g) => g.isAdmin)) return { isAdmin: true, permissions: registry.allSystemIds() };

    const groupIds = groups.map((g) => g.id);
    const [groupPerms, accountPerms] = await Promise.all([
        groupIds.length ? GroupPermission.findAll({ where: { groupId: { [Op.in]: groupIds } } }) : [],
        AccountPermission.findAll({ where: { accountId } }),
    ]);

    const valuesByPermission = new Map();
    for (const gp of groupPerms) {
        if (!valuesByPermission.has(gp.permission)) valuesByPermission.set(gp.permission, new Map());
        valuesByPermission.get(gp.permission).set(gp.groupId, gp.value);
    }

    const orderedGroupIds = groups.sort(byPriority).map((g) => g.id);
    const overrides = new Map(accountPerms.map((ap) => [ap.permission, ap.value]));

    const resolve = (id) => {
        if (overrides.has(id)) return overrides.get(id);
        const perGroup = valuesByPermission.get(id);
        if (perGroup) for (const groupId of orderedGroupIds) {
            if (perGroup.has(groupId)) return perGroup.get(groupId);
        }
    };

    const permissions = registry.allSystemIds().filter((id) => resolve(id) === "allow");
    return { isAdmin: false, permissions };
};

const hasSystemPermission = async (accountId, permission) => {
    const { isAdmin, permissions } = await getSystemPermissions(accountId);
    return isAdmin || permission === ADMIN_WILDCARD || permissions.includes(permission);
};

const getOrganizationPermissions = async (accountId, organizationId) => {
    const orgId = parseInt(organizationId, 10);
    if (!accountId || Number.isNaN(orgId)) return { isOwner: false, isAdmin: false, permissions: [] };

    const system = await getSystemPermissions(accountId);
    const systemAdmin = system.isAdmin || system.permissions.includes(Permission.ORGANIZATIONS_MANAGE_ALL);

    const membership = await OrganizationMember.findOne({
        where: { organizationId: orgId, accountId, status: "active" },
    });

    if (systemAdmin) return { isOwner: !!membership && membership.role === "owner", isAdmin: true, permissions: registry.allOrgIds() };
    if (!membership) return { isOwner: false, isAdmin: false, permissions: [] };
    if (membership.role === "owner") return { isOwner: true, isAdmin: false, permissions: registry.allOrgIds() };

    const overrides = await OrganizationMemberPermission.findAll({
        where: { organizationId: orgId, accountId },
    });
    const overrideMap = new Map(overrides.map((o) => [o.permission, o.value]));
    const baseline = new Set(system.permissions);

    const permissions = registry.allOrgIds().filter((id) => {
        const override = overrideMap.get(id);
        return override ? override === "allow" : baseline.has(id);
    });
    return { isOwner: false, isAdmin: false, permissions };
};

const hasOrganizationPermission = async (accountId, organizationId, permission) => {
    const { permissions } = await getOrganizationPermissions(accountId, organizationId);
    return permissions.includes(permission);
};

module.exports = {
    getSystemPermissions,
    hasSystemPermission,
    getOrganizationPermissions,
    hasOrganizationPermission,
};
