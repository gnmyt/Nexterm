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

const syncMappedMembership = async (accountId, mapping, models) => {
    const [organizationId, role] = mapping;
    const organization = await models.organization.findByPk(organizationId);
    if (!organization) return null;

    const [membership, created] = await models.member.findOrCreate({
        where: { organizationId: organization.id, accountId },
        defaults: { role, status: "active", invitedBy: accountId, managedByOidc: true },
    });

    if (!created && membership.managedByOidc && membership.role !== role) {
        await models.member.update({ role }, { where: { organizationId: organization.id, accountId } });
    }

    return organization.id;
};

const removeStaleMembership = async (accountId, membership, dependencies) => {
    const where = { organizationId: membership.organizationId, accountId };
    await dependencies.memberModel.destroy({ where });
    await dependencies.permissionModel.destroy({ where });
    dependencies.revokeAccess(membership.organizationId, accountId);

    dependencies.logger.system("Removed OIDC-managed organization membership no longer matched by group claims", {
        accountId, organizationId: membership.organizationId,
    });
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
    const matchedOrganizationIds = await Promise.all(
        [...roleByOrgId].map(mapping => syncMappedMembership(accountId, mapping, {
            organization: organizationModel,
            member: memberModel,
        })),
    );
    const matchedOrgIds = new Set(matchedOrganizationIds.filter(id => id !== null));

    const managedMemberships = await memberModel.findAll({ where: { accountId, managedByOidc: true } });
    const staleMemberships = managedMemberships.filter(membership => (
        !matchedOrgIds.has(membership.organizationId) && membership.role !== "owner"
    ));

    await Promise.all(staleMemberships.map(membership => removeStaleMembership(accountId, membership, {
        memberModel,
        permissionModel,
        revokeAccess,
        logger: log,
    })));
};

module.exports = {
    extractGroupClaim,
    mergeOIDCClaims,
    resolveMappedRoles,
    syncOrganizationMemberships,
};
