const Entry = require("../models/Entry");
const Folder = require("../models/Folder");
const { listIdentities } = require("../controllers/identity");
const { hasOrganizationAccess } = require("./permission");

const isIdentityAllowedForScope = (identity, organizationId, accountId) => {
    if (!identity) return false;
    if (identity.organizationId !== null) return identity.organizationId === organizationId;
    return identity.accountId === accountId;
};

const validateIdentityIds = async (accountId, identityIds, organizationId = null) => {
    if (!identityIds?.length) return { valid: true };
    const accessible = new Map((await listIdentities(accountId)).map((identity) => [identity.id, identity]));
    if (identityIds.some((identityId) => !isIdentityAllowedForScope(accessible.get(identityId), organizationId, accountId))) {
        return { valid: false, error: { code: 403, message: "One or more identities are not available in this resource scope" } };
    }
    return { valid: true };
};

// Shared with validateEntryAccess in controllers/entry.js, so both resolve an entry's scope the same way
const getEntryScope = async (entry) => {
    if (entry.folderId) {
        const folder = await Folder.findByPk(entry.folderId);
        if (folder) return { organizationId: folder.organizationId || null, accountId: folder.accountId || null };
    }
    return { organizationId: entry.organizationId || null, accountId: entry.accountId || null };
};

const canAccessEntry = async (accountId, entry) => {
    if (!entry) return false;
    const { organizationId, accountId: ownerAccountId } = await getEntryScope(entry);
    if (organizationId) return hasOrganizationAccess(accountId, organizationId);
    return !ownerAccountId || ownerAccountId === accountId;
};

const isSameSecurityScope = (left, right) => left.organizationId
    ? left.organizationId === right.organizationId
    : !right.organizationId && left.accountId === right.accountId;

const isInsideFolder = async (folderId, ancestorFolderId) => {
    let currentFolderId = folderId;
    while (currentFolderId) {
        if (Number(currentFolderId) === Number(ancestorFolderId)) return true;
        const folder = await Folder.findByPk(currentFolderId);
        currentFolderId = folder?.parentId || null;
    }
    return false;
};

const validateJumpHostIds = async (accountId, jumpHostIds, options = {}) => {
    if (jumpHostIds === undefined || jumpHostIds === null) return { valid: true };
    if (!Array.isArray(jumpHostIds) || jumpHostIds.some((jumpHostId) => !Number.isInteger(jumpHostId))) {
        return { valid: false, error: { code: 400, message: "Jump hosts must be a list of server IDs" } };
    }
    if (!jumpHostIds.length) return { valid: true };
    for (const jumpHostId of jumpHostIds) {
        const jumpHost = await Entry.findByPk(jumpHostId);
        if (!jumpHost) {
            if (options.skipMissing) continue;
            return { valid: false, error: { code: 404, message: `Jump host with ID ${jumpHostId} does not exist` } };
        }
        if (jumpHost.type !== "server" || jumpHost.config?.protocol !== "ssh") {
            return { valid: false, error: { code: 400, message: `Jump host ${jumpHostId} is not an SSH server` } };
        }
        if (!(await canAccessEntry(accountId, jumpHost))) {
            return { valid: false, error: { code: 403, message: "You do not have permission to use this jump host" } };
        }
        if (options.enforceScope) {
            const movesWithFolder = options.movingFolderId && jumpHost.folderId
                ? await isInsideFolder(jumpHost.folderId, options.movingFolderId)
                : false;
            const scope = movesWithFolder
                ? { organizationId: options.organizationId || null, accountId: options.ownerAccountId || null }
                : await getEntryScope(jumpHost);
            const sameScope = isSameSecurityScope(
                { organizationId: options.organizationId || null, accountId: options.ownerAccountId || null },
                scope
            );
            if (!sameScope) {
                return { valid: false, error: { code: 400, message: "Jump hosts must be in the same security scope as the resource" } };
            }
        }
        if (options.excludedFolderId && jumpHost.folderId
            && await isInsideFolder(jumpHost.folderId, options.excludedFolderId)) {
            return { valid: false, error: { code: 400, message: "A folder cannot use one of its descendant servers as an inherited jump host" } };
        }
    }
    return { valid: true };
};

module.exports = { canAccessEntry, getEntryScope, isIdentityAllowedForScope, isSameSecurityScope, validateIdentityIds, validateJumpHostIds };
