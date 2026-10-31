const Folder = require("../models/Folder");
const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Identity = require("../models/Identity");
const Organization = require("../models/Organization");
const OrganizationMember = require("../models/OrganizationMember");
const { Op } = require("sequelize");
const { hasOrganizationAccess, hasOrganizationPermission, hasAccountPermission } = require("../utils/permission");
const { Permission } = require("../permissions/registry");
const { createAuditLog, AUDIT_ACTIONS, RESOURCE_TYPES } = require("./audit");
const stateBroadcaster = require("../lib/StateBroadcaster");
const SessionManager = require("../lib/SessionManager");
const { ALL_SECTIONS, getFolderInheritance, getInheritanceShapeError, getLocalProfiles, getLocalSectionState, getTemporaryIdentityReferenceError, INHERITANCE_KEY } = require("../utils/folderInheritance");
const { applyFolderTransitions, applyMovePolicy, collectSubtreeEntries, getInheritanceAffectedEntryCounts, getMoveImpact, snapshotEntry } = require("../utils/inheritanceLifecycle");
const sequelize = require("../utils/database");
const FolderIdentityProfile = require("../models/FolderIdentityProfile");
const { createIdentityInTransaction, listIdentities, updateIdentityInTransaction } = require("./identity");
const { isIdentityAllowedForScope, isSameSecurityScope, validateJumpHostIds } = require("../utils/resourceValidation");

const filterFolderIdentityProfiles = async (folder, organizationId, allowedPersonalAccountIds, transaction) => {
    const rows = await FolderIdentityProfile.findAll({ where: { folderId: folder.id }, transaction });
    if (!rows.length) return 0;
    const identities = await Identity.findAll({ where: { id: rows.map((row) => row.identityId) }, transaction });
    const identitiesById = new Map(identities.map((identity) => [identity.id, identity]));
    const invalidRowIds = rows.filter((row) => {
        const identity = identitiesById.get(row.identityId);
        if (!identity) return true;
        if (identity.organizationId !== null)
            return identity.organizationId !== organizationId || row.accountId !== null;
        return row.accountId !== identity.accountId || !allowedPersonalAccountIds.has(identity.accountId);
    }).map((row) => row.id);
    if (invalidRowIds.length) await FolderIdentityProfile.destroy({ where: { id: { [Op.in]: invalidRowIds } }, transaction });
    return invalidRowIds.length;
};

const saveFolderIdentityProfiles = async (folder, accountId, profiles, transaction) => {
    if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return { code: 400, message: "Invalid identity profiles" };
    const accessible = await listIdentities(accountId, { transaction });
    const accessibleById = new Map(accessible.map((identity) => [identity.id, identity]));
    const rows = [];
    for (const [protocol, identityIds] of Object.entries(profiles)) {
        if (!Array.isArray(identityIds) || identityIds.some((identityId) => !Number.isInteger(identityId)
            || !isIdentityAllowedForScope(accessibleById.get(identityId), folder.organizationId || null, accountId))) {
            return { code: 403, message: "One or more identities are not available in this folder scope" };
        }
        [...new Set(identityIds)].forEach((identityId, position) => {
            const identity = accessibleById.get(identityId);
            const shared = folder.organizationId && identity.organizationId === folder.organizationId;
            rows.push({ folderId: folder.id, protocol, identityId, accountId: shared ? null : accountId, position });
        });
    }
    await FolderIdentityProfile.destroy({
        where: { folderId: folder.id, [Op.or]: [{ accountId }, { accountId: null }] },
        transaction,
    });
    if (rows.length) await FolderIdentityProfile.bulkCreate(rows, { transaction });
    return { success: true };
};

const validateFolderProfiles = async (accountId, config, folderScope, options = {}) => {
    const inheritance = config?.[INHERITANCE_KEY];
    const shapeError = getInheritanceShapeError(inheritance, {
        allowEmbeddedIdentities: options.allowEmbeddedIdentities,
    });
    if (shapeError) return { code: 400, message: shapeError };
    for (const [protocol, profile] of Object.entries(getLocalProfiles(inheritance))) {
        if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { code: 400, message: "Invalid inheritance profile" };
        if (getLocalSectionState(inheritance, protocol, "settings") === "enabled" && profile.jumpHosts !== undefined) {
            const result = await validateJumpHostIds(accountId, profile.jumpHosts, {
                enforceScope: true,
                organizationId: folderScope.organizationId || null,
                ownerAccountId: folderScope.accountId || accountId,
                excludedFolderId: folderScope.id,
                movingFolderId: options.movingFolderId,
            });
            if (!result.valid) return result.error;
        }
    }
    return { success: true };
};

const validateFolderSubtreeProfiles = async (accountId, folder, organizationId, ownerAccountId, movingFolderId = folder.id) => {
    const validation = await validateFolderProfiles(accountId, folder.config, {
        id: folder.id,
        organizationId,
        accountId: ownerAccountId,
    }, { movingFolderId, allowEmbeddedIdentities: true });
    if (validation.code) return validation;
    const children = await Folder.findAll({ where: { parentId: folder.id } });
    for (const child of children) {
        const result = await validateFolderSubtreeProfiles(accountId, child, organizationId, ownerAccountId, movingFolderId);
        if (result.code) return result;
    }
    return { success: true };
};

const updateFolderContext = async (folderId, organizationId, accountId, oldOrganizationId = null, transaction = null, allowedPersonalAccountIds = null) => {
    if (oldOrganizationId !== organizationId && !allowedPersonalAccountIds) {
        allowedPersonalAccountIds = organizationId
            ? new Set((await OrganizationMember.findAll({
                where: { organizationId, status: "active" },
                attributes: ["accountId"],
                transaction,
            })).map((membership) => membership.accountId))
            : new Set([accountId]);
    }
    const folder = await Folder.findByPk(folderId, { transaction });
    let removedIdentityCount = oldOrganizationId !== organizationId
        ? await filterFolderIdentityProfiles(folder, organizationId, allowedPersonalAccountIds, transaction)
        : 0;

    await Folder.update(
        { organizationId, accountId },
        { where: { id: folderId }, transaction }
    );

    await Entry.update(
        { organizationId, accountId },
        { where: { folderId }, transaction }
    );

    const subfolders = await Folder.findAll({ where: { parentId: folderId }, transaction });
    for (const subfolder of subfolders) {
        removedIdentityCount += await updateFolderContext(subfolder.id, organizationId, accountId, oldOrganizationId, transaction, allowedPersonalAccountIds);
    }
    return removedIdentityCount;
};

const moveFolderWithLifecycle = async (accountId, folder, configuration) => {
    if (configuration.inheritanceTransitions?.length) {
        return { code: 400, message: "Move the folder separately from changing its inheritance settings" };
    }
    if (configuration.config !== undefined || configuration.identityProfiles !== undefined
        || configuration.identityCreates !== undefined || configuration.identityUpdates !== undefined) {
        return { code: 400, message: "Move the folder separately from changing its settings" };
    }

    const targetParentId = configuration.parentId;
    let targetFolder = null;
    let targetOrganizationId = configuration.organizationId ?? null;
    let targetAccountId = targetOrganizationId ? null : accountId;

    if (targetParentId !== null) {
        targetFolder = await Folder.findByPk(targetParentId);
        if (!targetFolder) return { code: 302, message: "Target parent folder does not exist" };

        if (targetFolder.organizationId) {
            if (!(await hasOrganizationPermission(accountId, targetFolder.organizationId, Permission.RESOURCES_MANAGE))) {
                return { code: 403, message: "You don't have permission to manage resources in the target organization" };
            }
        } else if (targetFolder.accountId !== accountId) {
            return { code: 403, message: "You don't have access to the target parent folder" };
        } else if (!(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
            return { code: 403, message: "You don't have permission to manage resources in the target location" };
        }

        let current = targetFolder;
        while (current) {
            if (current.id === folder.id) return { code: 303, message: "Cannot move folder to its own subfolder" };
            current = current.parentId ? await Folder.findByPk(current.parentId) : null;
        }
        targetOrganizationId = targetFolder.organizationId || null;
        targetAccountId = targetOrganizationId ? null : accountId;
    } else if (targetOrganizationId && !(await hasOrganizationPermission(accountId, targetOrganizationId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources in the target organization" };
    } else if (!targetOrganizationId && !(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources in the target location" };
    }
    const profileValidation = await validateFolderSubtreeProfiles(accountId, folder, targetOrganizationId, targetAccountId);
    if (profileValidation.code) return profileValidation;

    const changesScope = !isSameSecurityScope(
        { organizationId: folder.organizationId || null, accountId: folder.accountId || null },
        { organizationId: targetOrganizationId, accountId: targetAccountId }
    );
    const subtreeEntries = changesScope ? await collectSubtreeEntries(folder.id) : [];
    for (const entry of subtreeEntries) {
        const jumpHostValidation = await validateJumpHostIds(accountId, entry.config?.jumpHosts, {
            enforceScope: true,
            skipMissing: true,
            organizationId: targetOrganizationId,
            ownerAccountId: targetAccountId,
            movingFolderId: folder.id,
        });
        if (!jumpHostValidation.valid) return jumpHostValidation.error;
    }

    const inheritancePolicy = configuration.inheritancePolicy;
    const update = { ...configuration };
    delete update.inheritancePolicy;
    delete update.inheritanceTransitions;
    delete update.organizationId;
    delete update.accountId;

    let moveResult = { impact: { entryCount: 0, sections: [], warnings: [] }, removedIdentityCount: 0 };
    let movedEntryIds = [];
    try {
        await sequelize.transaction(async (transaction) => {
            const entries = await collectSubtreeEntries(folder.id, transaction);
            const snapshots = [];
            for (const entry of entries) snapshots.push(await snapshotEntry(entry, transaction));
            movedEntryIds = entries.map((entry) => entry.id);

            const removedFolderIdentityCount = await updateFolderContext(folder.id, targetOrganizationId, targetAccountId, folder.organizationId, transaction);
            await Folder.update(update, { where: { id: folder.id }, transaction });

            const impact = await getMoveImpact(snapshots, transaction);
            moveResult.impact = impact;
            if (impact.entryCount > 0 && !inheritancePolicy) {
                const error = new Error("Choose how moved objects should handle destination inheritance");
                error.lifecycleError = { code: 409, reason: "inheritance_policy_required", message: error.message, impact };
                throw error;
            }
            const applied = await applyMovePolicy(snapshots, inheritancePolicy || "adopt", targetOrganizationId, accountId, transaction);
            moveResult.removedIdentityCount = removedFolderIdentityCount + applied.removedIdentityCount;
        });
    } catch (error) {
        if (error.lifecycleError) return error.lifecycleError;
        throw error;
    }

    if (folder.organizationId !== targetOrganizationId) {
        for (const entryId of movedEntryIds) await SessionManager.removeAllByEntryId(entryId);
    }

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_MGMT_UPDATE,
        accountId,
        organizationId: targetOrganizationId,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folder.id,
        details: { action: "move", parentId: targetParentId, inheritancePolicy, ...moveResult },
    });
    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: folder.organizationId });
    if (targetOrganizationId !== folder.organizationId) stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: targetOrganizationId });
    return { success: true, ...moveResult };
};

module.exports.createFolder = async (accountId, configuration) => {
    if (configuration.parentId && !configuration.organizationId) {
        const parentFolder = await Folder.findByPk(configuration.parentId);
        if (parentFolder === null) {
            return { code: 302, message: "Parent folder does not exist" };
        }

        if (parentFolder.organizationId) {
            configuration.organizationId = parentFolder.organizationId;
        }
    }

    if (configuration.organizationId) {
        const hasAccess = await hasOrganizationPermission(accountId, configuration.organizationId, Permission.RESOURCES_MANAGE);
        if (!hasAccess) {
            return { code: 403, message: "You don't have permission to manage resources in this organization" };
        }
    } else if (!(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources" };
    }

    if (configuration.parentId) {
        const parentFolder = await Folder.findByPk(configuration.parentId);
        if (parentFolder === null) {
            return { code: 302, message: "Parent folder does not exist" };
        }

        if (configuration.organizationId && parentFolder.organizationId !== configuration.organizationId) {
            return { code: 403, message: "Parent folder must be in the same organization" };
        } else if (!configuration.organizationId && parentFolder.accountId !== accountId) {
            return { code: 403, message: "You don't have access to the parent folder" };
        }
    }

    if (configuration.config !== undefined) {
        const profileValidation = await validateFolderProfiles(accountId, configuration.config, {
            id: null,
            organizationId: configuration.organizationId || null,
            accountId: configuration.organizationId ? null : accountId,
        });
        if (profileValidation.code) return profileValidation;
    }

    const folder = await Folder.create({
        name: configuration.name,
        accountId: configuration.organizationId ? null : accountId,
        organizationId: configuration.organizationId || null,
        parentId: configuration.parentId,
        config: configuration.config || null,
    });

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_MGMT_CREATE,
        accountId,
        organizationId: configuration.organizationId || null,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folder.id,
        details: { folderName: configuration.name },
    });

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: configuration.organizationId });

    return folder;
};

module.exports.deleteFolder = async (accountId, folderId) => {
    const folder = await Folder.findByPk(folderId);

    if (folder === null) {
        return { code: 301, message: "Folder does not exist" };
    }

    if (folder.organizationId) {
        if (!(await hasOrganizationPermission(accountId, folder.organizationId, Permission.RESOURCES_MANAGE)))
            return { code: 403, message: "You don't have permission to manage resources in this organization" };
    } else if (folder.accountId !== accountId) {
        return { code: 403, message: "You don't have permission to delete this folder" };
    } else if (!(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources" };
    }

    let subfolders = await Folder.findAll({ where: { parentId: folderId } });
    for (let subfolder of subfolders) {
        await module.exports.deleteFolder(accountId, subfolder.id);
    }

    await Entry.destroy({ where: { folderId: folderId } });

    await Folder.destroy({ where: { id: folderId } });

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_MGMT_DELETE,
        accountId,
        organizationId: folder.organizationId,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folderId,
        details: { folderName: folder.name },
    });

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: folder.organizationId });

    return { success: true };
};

module.exports.editFolder = async (accountId, folderId, configuration) => {
    const folder = await Folder.findByPk(folderId);

    if (folder === null) {
        return { code: 301, message: "Folder does not exist" };
    }

    if (folder.organizationId) {
        if (!(await hasOrganizationPermission(accountId, folder.organizationId, Permission.RESOURCES_MANAGE)))
            return { code: 403, message: "You don't have permission to manage resources in this organization" };
    } else if (folder.accountId !== accountId) {
        return { code: 403, message: "You don't have permission to edit this folder" };
    } else if (!(await hasAccountPermission(accountId, Permission.RESOURCES_MANAGE))) {
        return { code: 403, message: "You don't have permission to manage resources" };
    }

    if (configuration.parentId !== undefined && folder.type === "integration-node") {
        return { code: 403, message: "Integration nodes cannot be moved out of their integration folder" };
    }

    const changesParent = configuration.parentId !== undefined && configuration.parentId !== folder.parentId;
    const changesRootContext = configuration.parentId === null
        && (configuration.organizationId ?? null) !== (folder.organizationId ?? null);
    if (changesParent || changesRootContext) {
        return moveFolderWithLifecycle(accountId, folder, configuration);
    }

    const identityProfiles = configuration.identityProfiles;
    const identityCreates = configuration.identityCreates || [];
    const identityUpdates = configuration.identityUpdates || [];
    const inheritanceTransitions = configuration.inheritanceTransitions || [];
    delete configuration.identityProfiles;
    delete configuration.identityCreates;
    delete configuration.identityUpdates;
    delete configuration.inheritanceTransitions;
    delete configuration.inheritancePolicy;

    delete configuration.accountId;
    delete configuration.organizationId;

    const identityReferenceError = getTemporaryIdentityReferenceError(identityProfiles, identityCreates);
    if (identityReferenceError) return { code: 400, message: identityReferenceError };

    if (configuration.config !== undefined) {
        const profileValidation = await validateFolderProfiles(accountId, configuration.config, folder);
        if (profileValidation.code) return profileValidation;
    }

    let lifecycleResult = { affectedEntryCount: 0, changes: [] };
    const identityAuditEvents = [];
    let resolvedIdentityProfiles = identityProfiles;
    try {
        await sequelize.transaction(async (transaction) => {
            const transactionalFolder = await Folder.findByPk(folderId, { transaction, lock: transaction.LOCK.UPDATE });
            if (configuration.config !== undefined) {
                const transitionResult = await applyFolderTransitions(transactionalFolder, configuration.config, inheritanceTransitions, transaction);
                if (transitionResult.code) {
                    const error = new Error(transitionResult.message);
                    error.lifecycleError = transitionResult;
                    throw error;
                }
                lifecycleResult = transitionResult;
            } else if (inheritanceTransitions.length) {
                const error = new Error("Inheritance transitions require a folder configuration");
                error.lifecycleError = { code: 400, message: error.message };
                throw error;
            }

            const createdIdentityIds = new Map();
            for (const identityCreate of identityCreates) {
                const identity = await createIdentityInTransaction(accountId, identityCreate.config, transaction);
                if (identity.code) {
                    const error = new Error(identity.message);
                    error.lifecycleError = identity;
                    throw error;
                }
                createdIdentityIds.set(identityCreate.temporaryId, identity.id);
                identityAuditEvents.push({ action: "create", identity, config: identityCreate.config });
            }

            for (const identityUpdate of identityUpdates) {
                const identityResult = await updateIdentityInTransaction(
                    accountId, identityUpdate.id, identityUpdate.config, transaction
                );
                if (identityResult.code) {
                    const error = new Error(identityResult.message);
                    error.lifecycleError = identityResult;
                    throw error;
                }
                identityAuditEvents.push({ action: "update", identity: identityResult.identity, config: identityUpdate.config });
            }

            if (identityProfiles !== undefined) {
                resolvedIdentityProfiles = Object.fromEntries(Object.entries(identityProfiles).map(([protocol, identityIds]) => [
                    protocol,
                    identityIds.map((identityId) => typeof identityId === "string" ? createdIdentityIds.get(identityId) : identityId),
                ]));
                if (Object.values(resolvedIdentityProfiles).some((identityIds) => identityIds.some((identityId) => !Number.isInteger(identityId)))) {
                    const error = new Error("Identity profiles contain an unknown temporary identity");
                    error.lifecycleError = { code: 400, message: error.message };
                    throw error;
                }
                const identityResult = await saveFolderIdentityProfiles(transactionalFolder, accountId, resolvedIdentityProfiles, transaction);
                if (identityResult.code) {
                    const error = new Error(identityResult.message);
                    error.lifecycleError = identityResult;
                    throw error;
                }
            }

            await Folder.update(configuration, { where: { id: folderId }, transaction });
        });
    } catch (error) {
        if (error.lifecycleError) return error.lifecycleError;
        throw error;
    }

    await createAuditLog({
        action: AUDIT_ACTIONS.FOLDER_MGMT_UPDATE,
        accountId,
        organizationId: folder.organizationId,
        resource: RESOURCE_TYPES.FOLDER,
        resourceId: folderId,
        details: {
            ...configuration,
            ...(resolvedIdentityProfiles !== undefined ? { identityProfiles: resolvedIdentityProfiles } : {}),
            inheritanceTransitions: lifecycleResult.changes,
            affectedEntryCount: lifecycleResult.affectedEntryCount,
        },
    });

    for (const event of identityAuditEvents) {
        const isCreate = event.action === "create";
        await createAuditLog({
            action: isCreate ? AUDIT_ACTIONS.IDENTITY_CREATE : AUDIT_ACTIONS.IDENTITY_UPDATE,
            accountId,
            organizationId: event.identity.organizationId || null,
            resource: RESOURCE_TYPES.IDENTITY,
            resourceId: event.identity.id,
            details: isCreate ? {
                identityName: event.config.name,
                identityType: event.config.type,
                scope: event.config.organizationId ? "organization" : "personal",
            } : {
                identityName: event.config.name || event.identity.name,
                identityType: event.config.type || event.identity.type,
                updatedFields: Object.keys(event.config).filter((key) => !["password", "sshKey", "passphrase"].includes(key)),
            },
        });
    }

    stateBroadcaster.broadcast("ENTRIES", { accountId, organizationId: folder.organizationId });
    if (identityCreates.length || identityUpdates.length) {
        stateBroadcaster.broadcast("IDENTITIES", { accountId, organizationId: folder.organizationId });
    }

    return { success: true };
};

module.exports.listFolders = async (accountId) => {
    const personalFolders = await Folder.findAll({
        where: { accountId: accountId },
        order: [["parentId", "ASC"], ["position", "ASC"]],
    });

    const memberships = await OrganizationMember.findAll({ where: { accountId, status: "active" } });
    const organizationIds = memberships.map(m => m.organizationId);

    let organizationFolders = [];
    if (organizationIds.length > 0) {
        organizationFolders = await Folder.findAll({
            where: { organizationId: { [Op.in]: organizationIds } },
            order: [["organizationId", "ASC"], ["parentId", "ASC"], ["position", "ASC"]],
        });
    }

    const allFolders = [...personalFolders, ...organizationFolders];
    const folderMap = new Map();
    let rootFolders = [];

    allFolders.forEach(folder => {
        folderMap.set(folder.id, {
            id: folder.id,
            name: folder.name,
            type: "folder",
            folderType: folder.type,
            integrationId: folder.integrationId,
            position: folder.position,
            organizationId: folder.organizationId,
            entries: [],
        });
    });

    allFolders.forEach(folder => {
        if (folder.parentId) {
            const parentFolder = folderMap.get(folder.parentId);
            if (parentFolder) {
                parentFolder.entries.push(folderMap.get(folder.id));
            } else {
                rootFolders.push(folderMap.get(folder.id));
            }
        } else {
            rootFolders.push(folderMap.get(folder.id));
        }
    });

    const result = [];

    const personalRootFolders = rootFolders.filter(f => !f.organizationId);
    if (personalRootFolders.length > 0) {
        result.push(...personalRootFolders);
    }

    if (organizationIds.length > 0) {
        const organizations = await Organization.findAll({ where: { id: { [Op.in]: organizationIds } } });

        const orgFoldersByOrg = {};
        rootFolders.forEach(folder => {
            if (folder.organizationId) {
                if (!orgFoldersByOrg[folder.organizationId]) {
                    orgFoldersByOrg[folder.organizationId] = [];
                }
                orgFoldersByOrg[folder.organizationId].push(folder);
            }
        });

        organizations.forEach(org => {
            const requireConnectionReason = org.auditSettings?.requireConnectionReason || false;

            result.push({
                id: `org-${org.id}`,
                name: org.name,
                type: "organization",
                requireConnectionReason,
                entries: orgFoldersByOrg[org.id] || [],
            });
        });
    }

    return result;
};

module.exports.getFolderById = async (accountId, folderId, protocol = null) => {
    const folder = await Folder.findByPk(folderId);

    if (!folder) {
        return { code: 301, message: "Folder does not exist" };
    }

    if (folder.accountId && folder.accountId !== accountId) {
        return { code: 403, message: "You don't have permission to access this folder" };
    } else if (folder.organizationId) {
        const hasAccess = await hasOrganizationAccess(accountId, folder.organizationId);
        if (!hasAccess) {
            return { code: 403, message: "You don't have access to this organization's folder" };
        }
    }

    const inheritanceAffectedEntryCounts = protocol ? undefined : await getInheritanceAffectedEntryCounts(folder.id);
    const inheritance = await getFolderInheritance(folder.id, protocol, { accountId });
    const parentInheritance = folder.parentId
        ? await getFolderInheritance(folder.parentId, protocol, { accountId })
        : { config: {}, identities: [], profiles: {}, identityProfiles: {}, sectionSources: {} };
    const allInheritance = inheritance;
    const allParentInheritance = parentInheritance;
    const localIdentityRows = protocol ? [] : await FolderIdentityProfile.findAll({
        where: { folderId: folder.id, [Op.or]: [{ accountId }, { accountId: null }] },
        order: [["position", "ASC"], ["id", "ASC"]],
    });
    const localIdentityProfiles = {};
    localIdentityRows.forEach((row) => {
        localIdentityProfiles[row.protocol] = [...(localIdentityProfiles[row.protocol] || []), row.identityId];
    });
    const rawInheritance = folder.config?.[INHERITANCE_KEY] || {};
    const protocols = new Set([
        ...Object.keys(allInheritance.profiles || {}),
        ...Object.keys(allInheritance.identityProfiles || {}),
        ...Object.keys(rawInheritance.sectionEnabled || {}),
        ...Object.keys(getLocalProfiles(rawInheritance)),
    ]);
    const buildSectionStates = (raw, resolved, protocolSet) => {
        const states = {};
        protocolSet.forEach((profileProtocol) => {
            states[profileProtocol] = {};
            ALL_SECTIONS.forEach((section) => {
                const source = resolved.sectionSources?.[profileProtocol]?.[section] || { state: "transparent", folderId: null };
                states[profileProtocol][section] = {
                    local: getLocalSectionState(raw, profileProtocol, section),
                    effective: source.state === "enabled" ? "enabled" : "disabled",
                    sourceFolderId: source.folderId,
                };
            });
        });
        return states;
    };
    const sectionStates = buildSectionStates(rawInheritance, allInheritance, protocols);
    const parentFolder = folder.parentId ? await Folder.findByPk(folder.parentId) : null;
    const parentRawInheritance = parentFolder?.config?.[INHERITANCE_KEY] || {};
    const parentProtocols = new Set([
        ...Object.keys(allParentInheritance.profiles || {}),
        ...Object.keys(allParentInheritance.identityProfiles || {}),
        ...Object.keys(parentRawInheritance.sectionEnabled || {}),
    ]);
    const inheritedSectionStates = buildSectionStates(parentRawInheritance, allParentInheritance, parentProtocols);

    return {
        ...folder,
        rawConfig: folder.config || {},
        localProfiles: getLocalProfiles(rawInheritance),
        inheritanceAffectedEntryCounts,
        config: inheritance.config,
        inheritedConfig: parentInheritance.config,
        identities: inheritance.identities,
        inheritedIdentities: parentInheritance.identities,
        profiles: allInheritance.profiles,
        inheritedProfiles: allParentInheritance.profiles,
        identityProfiles: allInheritance.identityProfiles,
        localIdentityProfiles,
        sectionStates,
        inheritedSectionStates,
        inheritedIdentityProfiles: allParentInheritance.identityProfiles,
    };
};
