const { Op } = require("sequelize");
const OrganizationMember = require("../models/OrganizationMember");
const PermissionGroup = require("../models/PermissionGroup");
const GroupMember = require("../models/GroupMember");
const Folder = require("../models/Folder");
const { getSystemPermissions, getOrganizationPermissions } = require("../permissions/engine");

exports.getAdminGroupIds = async () =>
    (await PermissionGroup.findAll({ where: { isAdmin: true }, attributes: ["id"] })).map((g) => g.id);

exports.getAdminAccountIds = async () => {
    const adminGroupIds = await exports.getAdminGroupIds();
    if (!adminGroupIds.length) return new Set();
    const members = await GroupMember.findAll({ where: { groupId: { [Op.in]: adminGroupIds } } });
    return new Set(members.map((m) => m.accountId));
};

exports.isAccountAdmin = async (accountId) => {
    const adminGroupIds = await exports.getAdminGroupIds();
    if (!adminGroupIds.length) return false;
    return !!(await GroupMember.findOne({ where: { accountId, groupId: { [Op.in]: adminGroupIds } } }));
};

exports.countAdmins = async () => {
    const adminGroupIds = await exports.getAdminGroupIds();
    if (!adminGroupIds.length) return 0;
    return GroupMember.count({ where: { groupId: { [Op.in]: adminGroupIds } }, distinct: true, col: "accountId" });
};

exports.hasOrganizationAccess = async (accountId, organizationId) => {
    if (!organizationId) return false;

    const membership = await OrganizationMember.findOne({ where: { accountId, organizationId, status: "active" } });

    return !!membership;
};

exports.hasOrganizationPermission = async (accountId, organizationId, permission) => {
    if (!organizationId) return false;

    const { permissions } = await getOrganizationPermissions(accountId, organizationId);
    return permissions.includes(permission);
};

exports.hasAccountPermission = async (accountId, permission) => {
    const { isAdmin, permissions } = await getSystemPermissions(accountId);
    return isAdmin || permissions.includes(permission);
};

exports.hasResourcePermission = async (accountId, organizationId, permission) =>
    organizationId
        ? exports.hasOrganizationPermission(accountId, organizationId, permission)
        : exports.hasAccountPermission(accountId, permission);

exports.validateFolderAccess = async (accountId, folderId, requiredPermission = null) => {
    const folder = await Folder.findByPk(folderId);
    if (!folder) {
        return { valid: false, error: { code: 301, message: "Folder does not exist" } };
    }

    if (folder.organizationId) {
        const allowed = requiredPermission
            ? await exports.hasOrganizationPermission(accountId, folder.organizationId, requiredPermission)
            : await exports.hasOrganizationAccess(accountId, folder.organizationId);
        if (!allowed) {
            return { valid: false, error: { code: 403, message: "You don't have access to this organization" } };
        }
    } else if (folder.accountId !== accountId) {
        return { valid: false, error: { code: 403, message: "You don't have access to this folder" } };
    } else if (requiredPermission && !(await exports.hasAccountPermission(accountId, requiredPermission))) {
        return { valid: false, error: { code: 403, message: "You don't have permission to manage resources" } };
    }

    return { valid: true, folder };
};
