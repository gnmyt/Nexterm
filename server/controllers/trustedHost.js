const { Op } = require("sequelize");
const TrustedHost = require("../models/TrustedHost");
const OrganizationMember = require("../models/OrganizationMember");
const { hasOrganizationPermission, hasAccountPermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { scopeLabel } = require("../utils/hostTrust");

const NOT_FOUND = { code: 404, message: "Trusted certificate not found" };

module.exports.listTrustedHosts = async (accountId) => {
    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    const organizationIds = memberships.map((membership) => membership.organizationId);
    const managesSystem = await hasAccountPermission(accountId, Permission.SETTINGS_AUTH_PROVIDERS);

    const [personal, shared, system] = await Promise.all([
        TrustedHost.findAll({ where: { accountId, organizationId: null } }),
        organizationIds.length ? TrustedHost.findAll({ where: { organizationId: { [Op.in]: organizationIds } } }) : [],
        managesSystem ? TrustedHost.findAll({ where: { accountId: null, organizationId: null } }) : [],
    ]);

    const manageable = new Map(await Promise.all(organizationIds.map(async (organizationId) =>
        [organizationId, await hasOrganizationPermission(accountId, organizationId, Permission.ORG_CERTIFICATES_MANAGE)])));

    return [...personal, ...shared, ...system].map((record) => ({
        id: record.id,
        kind: record.kind,
        host: record.host,
        port: record.port,
        algorithm: record.algorithm,
        fingerprint: record.fingerprint,
        scope: scopeLabel(record),
        organizationId: record.organizationId,
        canManage: record.organizationId ? manageable.get(record.organizationId) === true : true,
    }));
};

module.exports.deleteTrustedHost = async (accountId, id) => {
    const record = await TrustedHost.findByPk(id);
    if (!record) return NOT_FOUND;

    if (record.organizationId) {
        if (!(await hasOrganizationPermission(accountId, record.organizationId, Permission.ORG_CERTIFICATES_MANAGE)))
            return { code: 403, message: "You don't have permission to manage this organization's trusted certificates" };
    } else {
        const owned = record.accountId
            ? record.accountId === accountId
            : await hasAccountPermission(accountId, Permission.SETTINGS_AUTH_PROVIDERS);
        if (!owned) return NOT_FOUND;
    }

    await TrustedHost.destroy({ where: { id: record.id } });
    return { record };
};
