const { getSystemPermissions, getOrganizationPermissions } = require("../permissions/engine");
const { ADMIN_WILDCARD } = require("../permissions/registry");

const requirePermission = (permission) => async (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, message: "Unauthorized" });

    const resolved = req.permissions || (req.permissions = await getSystemPermissions(req.user.id));

    if (resolved.isAdmin || resolved.permissions.includes(permission)) return next();

    return res.status(403).json({ code: 403, message: "Forbidden" });
};

const requireOrgPermission = (permission, resolveOrgId) => async (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, message: "Unauthorized" });

    const organizationId = resolveOrgId ? resolveOrgId(req) : req.params.organizationId || req.params.id;

    const resolved = await getOrganizationPermissions(req.user.id, organizationId);
    req.orgPermissions = resolved;

    if (resolved.permissions.includes(permission)) return next();

    return res.status(403).json({ code: 403, message: "Forbidden" });
};

module.exports = {
    requirePermission,
    requireOrgPermission,
    isAdmin: requirePermission(ADMIN_WILDCARD),
};
