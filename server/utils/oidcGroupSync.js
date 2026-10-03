const mergeOIDCClaims = (idTokenClaims = {}, userinfo = {}) => ({
    ...idTokenClaims,
    ...userinfo,
});

const extractGroupClaim = (claims, attribute) => {
    if (!attribute) return [];

    const raw = claims?.[attribute];
    if (!raw) return [];

    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return raw.split(/[,\s]+/).filter(Boolean);

    return [];
};

const resolveMappedRoles = (groups, mappings) => {
    const groupSet = new Set(groups);
    const roleByOrgId = new Map();

    for (const mapping of mappings) {
        if (!groupSet.has(mapping.value)) continue;

        const role = mapping.role === "owner" ? "owner" : "member";
        if (role === "owner" || !roleByOrgId.has(mapping.organizationId)) {
            roleByOrgId.set(mapping.organizationId, role);
        }
    }

    return roleByOrgId;
};

const syncOrganizationMemberships = async (accountId, groups, provider, dependencies = {}) => {
    const organizationModel = dependencies.organizationModel || require("../models/Organization");
    const memberModel = dependencies.memberModel || require("../models/OrganizationMember");
    const permissionModel = dependencies.permissionModel || require("../models/OrganizationMemberPermission");
    const revokeAccess = dependencies.revokeAccess
        || require("../controllers/liveSession").revokeLiveSessionAccess;
    const log = dependencies.logger || require("./logger");
    const mappings = Array.isArray(provider.groupMappings) ? provider.groupMappings : [];
    const roleByOrgId = resolveMappedRoles(groups, mappings);
    const matchedOrgIds = new Set();

    for (const [organizationId, role] of roleByOrgId) {
        const organization = await organizationModel.findByPk(organizationId);
        if (!organization) continue;

        matchedOrgIds.add(organization.id);

        const [membership, created] = await memberModel.findOrCreate({
            where: { organizationId: organization.id, accountId },
            defaults: { role, status: "active", invitedBy: accountId, managedByOidc: true },
        });

        if (!created && membership.managedByOidc && membership.role !== role) {
            await memberModel.update({ role }, { where: { organizationId: organization.id, accountId } });
        }
    }

    const managedMemberships = await memberModel.findAll({ where: { accountId, managedByOidc: true } });

    for (const membership of managedMemberships) {
        if (matchedOrgIds.has(membership.organizationId)) continue;
        if (membership.role === "owner") continue;

        await memberModel.destroy({ where: { organizationId: membership.organizationId, accountId } });
        await permissionModel.destroy({ where: { organizationId: membership.organizationId, accountId } });
        revokeAccess(membership.organizationId, accountId);

        log.system("Removed OIDC-managed organization membership no longer matched by group claims", {
            accountId, organizationId: membership.organizationId,
        });
    }
};

module.exports = {
    extractGroupClaim,
    mergeOIDCClaims,
    resolveMappedRoles,
    syncOrganizationMemberships,
};
