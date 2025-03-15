const OrganizationMember = require("../models/OrganizationMember");
const Folder = require("../models/Folder");

exports.hasOrganizationAccess = async (accountId, organizationId) => {
    if (!organizationId) return false;

    const membership = await OrganizationMember.findOne({ where: { accountId, organizationId, status: "active" } });

    return !!membership;
};

exports.validateFolderAccess = async (accountId, folderId) => {
    const folder = await Folder.findByPk(folderId);
    if (!folder) {
        return { valid: false, error: { code: 301, message: "Folder does not exist" } };
    }

    if (folder.organizationId) {
        const hasAccess = await exports.hasOrganizationAccess(accountId, folder.organizationId);
        if (!hasAccess) {
            return { valid: false, error: { code: 403, message: "You don't have access to this organization" } };
        }
    } else {
        if (folder.accountId !== accountId) {
            return { valid: false, error: { code: 403, message: "You don't have access to this folder" } };
        }
    }

    return { valid: true, folder };
};