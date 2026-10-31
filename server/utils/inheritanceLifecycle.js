const Entry = require("../models/Entry");
const EntryIdentity = require("../models/EntryIdentity");
const Folder = require("../models/Folder");
const Identity = require("../models/Identity");
const OrganizationMember = require("../models/OrganizationMember");
const {
    ALL_SECTIONS,
    CONFIG_SECTIONS,
    INHERITANCE_KEY,
    getEntryIdentityIds,
    getFolderInheritance,
    getFolderLineage,
    getLocalProfiles,
    getLocalSectionState,
    SUPPORTED_PROTOCOLS,
    pickSectionConfig,
    replaceSectionConfig,
    resolveProtocol,
    withoutInheritance,
} = require("./folderInheritance");

const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const toPlain = (value) => value?.toJSON ? value.toJSON() : { ...(value || {}) };
const sourceKey = (source) => `${source?.state || "transparent"}:${source?.folderId || ""}`;

const shouldTraverseChild = (section, state) => {
    if (state === "disabled") return false;
    if (section === "identities") return state === "transparent";
    return true;
};

const getProtocol = (entry) => withoutInheritance(entry.config).protocol;

const replaceEntryIdentities = async (entryId, identityIds, transaction) => {
    await EntryIdentity.destroy({ where: { entryId }, transaction });
    if (!identityIds.length) return;
    await EntryIdentity.bulkCreate(identityIds.map((identityId, index) => ({
        entryId,
        identityId,
        isDefault: index === 0,
    })), { transaction });
};

const isIdentityAllowedForMove = (identity, organizationId, allowedPersonalAccountIds) => identity.organizationId !== null
    ? identity.organizationId === organizationId
    : allowedPersonalAccountIds.has(identity.accountId);

const filterIdentitiesForOrganization = async (identityIds, organizationId, allowedPersonalAccountIds, transaction) => {
    if (!identityIds.length) return { identityIds: [], removed: 0 };
    const identities = await Identity.findAll({ where: { id: identityIds }, transaction });
    const allowed = new Set(identities
        .filter((identity) => isIdentityAllowedForMove(identity, organizationId, allowedPersonalAccountIds))
        .map((identity) => identity.id));
    const filtered = identityIds.filter((identityId) => allowed.has(identityId));
    return { identityIds: filtered, removed: identityIds.length - filtered.length };
};

// Personal folder identity rows belong to individual members: only the owner's rows apply in a personal scope, none in an organization scope
const identityRowOptions = async (entry, transaction) => {
    const folder = entry.folderId ? await Folder.findByPk(entry.folderId, { transaction }) : null;
    const organizationId = folder ? folder.organizationId : entry.organizationId;
    const ownerAccountId = folder ? folder.accountId : entry.accountId;
    return { accountId: organizationId ? null : (ownerAccountId ?? null) };
};

const snapshotEntry = async (entry, transaction) => {
    const protocol = getProtocol(entry);
    const rowOptions = await identityRowOptions(entry, transaction);
    const inheritance = entry.folderId
        ? await getFolderInheritance(entry.folderId, protocol, { ...rowOptions, transaction })
        : { config: {}, identities: [], sectionSources: {} };
    const localConfig = withoutInheritance(entry.config);
    const localIdentities = await EntryIdentity.findAll({
        where: { entryId: entry.id },
        order: [["isDefault", "DESC"], ["createdAt", "ASC"]],
        transaction,
    });
    return {
        entry: toPlain(entry),
        organizationId: entry.organizationId,
        protocol,
        localConfig,
        effectiveConfig: { ...inheritance.config, ...localConfig },
        effectiveIdentities: await getEntryIdentityIds(entry, { ...rowOptions, transaction }),
        localIdentityIds: localIdentities.map((identity) => identity.identityId),
        inheritance,
    };
};

const collectScopedEntries = async (folderId, protocol, section, transaction) => {
    const entries = (await Entry.findAll({ where: { folderId }, transaction }))
        .filter((entry) => entry.type === "server" && getProtocol(entry) === protocol);
    const children = await Folder.findAll({ where: { parentId: folderId }, transaction });

    for (const child of children) {
        const inheritance = child.config?.[INHERITANCE_KEY];
        const state = getLocalSectionState(inheritance, protocol, section);
        if (!shouldTraverseChild(section, state)) continue;
        entries.push(...await collectScopedEntries(child.id, protocol, section, transaction));
    }

    return entries;
};

const getInheritanceAffectedEntryCounts = async (folderId, transaction) => {
    const counts = Object.fromEntries(SUPPORTED_PROTOCOLS.map((protocol) => [
        protocol,
        Object.fromEntries(ALL_SECTIONS.map((section) => [section, 0])),
    ]));

    const walk = async (currentFolderId, reachable) => {
        const entries = await Entry.findAll({ where: { folderId: currentFolderId }, transaction });
        for (const entry of entries) {
            const protocol = getProtocol(entry);
            if (entry.type !== "server" || !SUPPORTED_PROTOCOLS.includes(protocol)) continue;
            for (const section of ALL_SECTIONS) {
                if (reachable[protocol]?.[section]) counts[protocol][section] += 1;
            }
        }

        const children = await Folder.findAll({ where: { parentId: currentFolderId }, transaction });
        for (const child of children) {
            const inheritance = child.config?.[INHERITANCE_KEY];
            const nextReachable = Object.fromEntries(SUPPORTED_PROTOCOLS.map((profileProtocol) => [
                profileProtocol,
                Object.fromEntries(ALL_SECTIONS.map((section) => [
                    section,
                    reachable[profileProtocol][section]
                        && shouldTraverseChild(section, getLocalSectionState(inheritance, profileProtocol, section)),
                ])),
            ]));
            await walk(child.id, nextReachable);
        }
    };

    const initialReachability = Object.fromEntries(SUPPORTED_PROTOCOLS.map((protocol) => [
        protocol, Object.fromEntries(ALL_SECTIONS.map((section) => [section, true])),
    ]));
    await walk(folderId, initialReachability);
    return counts;
};

const getChangedTransitions = (currentInheritance, nextInheritance) => {
    const protocols = new Set([
        ...Object.keys(getLocalProfiles(currentInheritance)),
        ...Object.keys(currentInheritance?.identityProfiles || {}),
        ...Object.keys(currentInheritance?.sectionEnabled || {}),
        ...Object.keys(getLocalProfiles(nextInheritance)),
        ...Object.keys(nextInheritance?.identityProfiles || {}),
        ...Object.keys(nextInheritance?.sectionEnabled || {}),
    ]);
    if (Object.hasOwn(currentInheritance || {}, "identities") || Object.hasOwn(nextInheritance || {}, "identities")) {
        SUPPORTED_PROTOCOLS.forEach((protocol) => protocols.add(protocol));
    }
    const changes = [];
    for (const protocol of protocols) {
        for (const section of ALL_SECTIONS) {
            const from = getLocalSectionState(currentInheritance, protocol, section);
            const to = getLocalSectionState(nextInheritance, protocol, section);
            if (from !== to) changes.push({ protocol, section, from, to });
        }
    }
    return changes;
};

const validateTransitions = (currentInheritance, nextInheritance, transitions = []) => {
    const changes = getChangedTransitions(currentInheritance, nextInheritance);
    const supplied = new Map(transitions.map((transition) => [`${transition.protocol}:${transition.section}`, transition]));
    for (const change of changes) {
        const transition = supplied.get(`${change.protocol}:${change.section}`);
        if (!transition || transition.from !== change.from || transition.to !== change.to) {
            return { code: 409, message: "Folder inheritance changed while it was being edited" };
        }
        if (transition.policy !== undefined && !["retain", "adopt"].includes(transition.policy)) {
            return { code: 400, message: "Invalid inheritance adoption policy" };
        }
    }
    if (supplied.size !== changes.length) return { code: 400, message: "Invalid inheritance transition" };
    return { changes: changes.map((change) => ({ ...change, ...supplied.get(`${change.protocol}:${change.section}`) })) };
};

const getConfigInheritanceWithOverride = async (entry, protocol, targetFolderId, nextConfig, transaction) => {
    const lineage = await getFolderLineage(entry.folderId, { transaction });
    const nextLineage = lineage.map((lineageFolder) => lineageFolder.id === targetFolderId
        ? { ...toPlain(lineageFolder), config: nextConfig }
        : lineageFolder);
    return {
        current: resolveProtocol(lineage, protocol).config,
        next: resolveProtocol(nextLineage, protocol).config,
    };
};

const getEffectiveChanges = async (folder, nextConfig, changes, transaction) => {
    const lineage = await getFolderLineage(folder.id, { transaction });
    const nextLineage = lineage.map((lineageFolder) => lineageFolder.id === folder.id
        ? { ...toPlain(lineageFolder), config: nextConfig }
        : lineageFolder);
    return changes.map((change) => {
        const currentSource = resolveProtocol(lineage, change.protocol).sectionSources[change.section];
        const nextSource = resolveProtocol(nextLineage, change.protocol).sectionSources[change.section];
        return {
            ...change,
            effectiveFrom: currentSource?.state === "enabled" ? "enabled" : "disabled",
            effectiveTo: nextSource?.state === "enabled" ? "enabled" : "disabled",
        };
    });
};

const applyFolderTransitions = async (folder, nextConfig, transitions, transaction) => {
    const currentInheritance = folder.config?.[INHERITANCE_KEY] || {};
    const nextInheritance = nextConfig?.[INHERITANCE_KEY] || {};
    const validation = validateTransitions(currentInheritance, nextInheritance, transitions);
    if (validation.code) return validation;
    const effectiveChanges = await getEffectiveChanges(folder, nextConfig, validation.changes, transaction);

    const entryActions = new Map();
    for (const transition of effectiveChanges.filter((change) => change.effectiveFrom !== change.effectiveTo)) {
        let entries = await collectScopedEntries(folder.id, transition.protocol, transition.section, transaction);
        if (transition.section !== "identities") {
            const affectedEntries = [];
            for (const entry of entries) {
                const inheritance = await getConfigInheritanceWithOverride(entry, transition.protocol, folder.id, nextConfig, transaction);
                if (!equal(pickSectionConfig(inheritance.current, transition.section), pickSectionConfig(inheritance.next, transition.section))) {
                    affectedEntries.push(entry);
                }
            }
            entries = affectedEntries;
        }
        if (entries.length && transition.effectiveFrom === "disabled" && transition.effectiveTo === "enabled"
            && !["retain", "adopt"].includes(transition.policy)) {
            return { code: 400, message: "An adoption policy is required when enabling inheritance" };
        }
        for (const entry of entries) {
            const current = entryActions.get(entry.id) || { entry, sections: new Map() };
            current.sections.set(transition.section, transition);
            entryActions.set(entry.id, current);
        }
    }

    for (const { entry, sections } of entryActions.values()) {
        const snapshot = await snapshotEntry(entry, transaction);
        let nextLocalConfig = { ...snapshot.localConfig };
        for (const [section, transition] of sections) {
            const retain = transition.effectiveTo !== "enabled" || transition.policy === "retain";
            if (section === "identities") {
                await replaceEntryIdentities(entry.id, retain ? snapshot.effectiveIdentities : [], transaction);
            } else {
                nextLocalConfig = replaceSectionConfig(
                    nextLocalConfig,
                    section,
                    retain ? pickSectionConfig(snapshot.effectiveConfig, section) : {}
                );
            }
        }
        await Entry.update({ config: nextLocalConfig }, { where: { id: entry.id }, transaction });
    }

    return { affectedEntryCount: entryActions.size, changes: effectiveChanges };
};

const collectSubtreeEntries = async (folderId, transaction) => {
    const entries = await Entry.findAll({ where: { folderId }, transaction });
    const children = await Folder.findAll({ where: { parentId: folderId }, transaction });
    for (const child of children) entries.push(...await collectSubtreeEntries(child.id, transaction));
    return entries.filter((entry) => entry.type === "server" && getProtocol(entry));
};

const configMoveRequiresChoice = (snapshot, nextInheritance, section) => {
    const oldSection = pickSectionConfig(snapshot.inheritance.config, section);
    const nextSection = pickSectionConfig(nextInheritance.config, section);
    const sourceChanged = sourceKey(snapshot.inheritance.sectionSources?.[section]) !== sourceKey(nextInheritance.sectionSources?.[section]);
    return nextInheritance.sectionSources?.[section]?.state === "enabled"
        && (!equal(oldSection, nextSection) || (sourceChanged && Object.keys(pickSectionConfig(snapshot.localConfig, section)).length > 0));
};

const getMoveImpact = async (snapshots, transaction) => {
    const impactedSections = new Set();
    let entryCount = 0;
    for (const snapshot of snapshots) {
        const nextInheritance = snapshot.entry.folderId
            ? await getFolderInheritance(snapshot.entry.folderId, snapshot.protocol, { ...(await identityRowOptions(snapshot.entry, transaction)), transaction })
            : { config: {}, identities: [], sectionSources: {} };
        let impacted = false;
        for (const section of CONFIG_SECTIONS) {
            if (configMoveRequiresChoice(snapshot, nextInheritance, section)) {
                impactedSections.add(`${snapshot.protocol}.${section}`);
                impacted = true;
            }
        }
        const oldIdentitySource = snapshot.inheritance.sectionSources?.identities;
        const nextIdentitySource = nextInheritance.sectionSources?.identities;
        if (sourceKey(oldIdentitySource) !== sourceKey(nextIdentitySource)
            && nextIdentitySource?.state === "enabled"
            && (!equal(snapshot.effectiveIdentities, nextInheritance.identities)
                || snapshot.localIdentityIds.length > 0)) {
            impactedSections.add(`${snapshot.protocol}.identities`);
            impacted = true;
        }
        if (impacted) entryCount += 1;
    }
    return { entryCount, sections: [...impactedSections].sort(), warnings: [] };
};

const applyMovePolicy = async (snapshots, policy, targetOrganizationId, accountId, transaction) => {
    let allowedPersonalAccountIds = null;
    const getAllowedPersonalAccountIds = async () => {
        if (allowedPersonalAccountIds) return allowedPersonalAccountIds;
        allowedPersonalAccountIds = targetOrganizationId
            ? new Set((await OrganizationMember.findAll({
                where: { organizationId: targetOrganizationId, status: "active" },
                attributes: ["accountId"],
                transaction,
            })).map((membership) => membership.accountId))
            : new Set([accountId]);
        return allowedPersonalAccountIds;
    };
    let removedIdentityCount = 0;
    for (const snapshot of snapshots) {
        const nextInheritance = snapshot.entry.folderId
            ? await getFolderInheritance(snapshot.entry.folderId, snapshot.protocol, { ...(await identityRowOptions(snapshot.entry, transaction)), transaction })
            : { config: {}, identities: [], sectionSources: {} };
        let nextLocalConfig = { ...snapshot.localConfig };

        for (const section of CONFIG_SECTIONS) {
            const sourceChanged = sourceKey(snapshot.inheritance.sectionSources?.[section]) !== sourceKey(nextInheritance.sectionSources?.[section]);
            const inheritedValuesChanged = !equal(
                pickSectionConfig(snapshot.inheritance.config, section),
                pickSectionConfig(nextInheritance.config, section)
            );
            if (!sourceChanged && !inheritedValuesChanged) continue;
            const nextSource = nextInheritance.sectionSources?.[section];
            const adopt = policy === "adopt" && nextSource?.state === "enabled";
            nextLocalConfig = replaceSectionConfig(
                nextLocalConfig,
                section,
                adopt ? {} : pickSectionConfig(snapshot.effectiveConfig, section)
            );
        }

        const oldIdentitySource = snapshot.inheritance.sectionSources?.identities;
        const nextIdentitySource = nextInheritance.sectionSources?.identities;
        const identitySourceChanged = sourceKey(oldIdentitySource) !== sourceKey(nextIdentitySource);
        if (identitySourceChanged || snapshot.organizationId !== targetOrganizationId) {
            const adopt = identitySourceChanged && policy === "adopt" && nextIdentitySource?.state === "enabled";
            const desiredIds = identitySourceChanged
                ? (adopt ? [] : snapshot.effectiveIdentities)
                : snapshot.localIdentityIds;
            const filtered = await filterIdentitiesForOrganization(desiredIds, targetOrganizationId, await getAllowedPersonalAccountIds(), transaction);
            removedIdentityCount += filtered.removed;
            await replaceEntryIdentities(snapshot.entry.id, filtered.identityIds, transaction);
        }

        await Entry.update({ config: nextLocalConfig }, { where: { id: snapshot.entry.id }, transaction });
    }
    return { removedIdentityCount };
};

module.exports = {
    applyFolderTransitions,
    applyMovePolicy,
    collectSubtreeEntries,
    configMoveRequiresChoice,
    getInheritanceAffectedEntryCounts,
    getMoveImpact,
    isIdentityAllowedForMove,
    shouldTraverseChild,
    snapshotEntry,
    toPlain,
    validateTransitions,
};
