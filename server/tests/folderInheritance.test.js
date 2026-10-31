const { after, test } = require("node:test");
const assert = require("node:assert/strict");

const database = require("../utils/database");
const {
    changesProtocol,
    getFolderInheritance,
    getInheritanceShapeError,
    getLocalProfiles,
    getLocalSectionState,
    getTemporaryIdentityReferenceError,
    mergeConfigWithProvenance,
    omitsProtocol,
    resolveProtocol,
} = require("../utils/folderInheritance");
const {
    configMoveRequiresChoice,
    isIdentityAllowedForMove,
    shouldTraverseChild,
    snapshotEntry,
    toPlain,
    validateTransitions,
} = require("../utils/inheritanceLifecycle");
const { isIdentityAllowedForScope, isSameSecurityScope } = require("../utils/resourceValidation");
const { folderEditValidation } = require("../validations/folder");
const { createServerValidation, repositionServerValidation, updateServerValidation } = require("../validations/server");
const Credential = require("../models/Credential");
const EntryIdentity = require("../models/EntryIdentity");
const Folder = require("../models/Folder");
const FolderIdentityProfile = require("../models/FolderIdentityProfile");
const { syncCredentials } = require("../controllers/identity");

const inheritanceConfig = (inheritance) => ({ __nextermInheritance: inheritance });

after(async () => {
    await database.close();
});

test("partial child profiles merge parent values within an enabled section", () => {
    const lineage = [
        {
            id: 1,
            config: inheritanceConfig({
                profiles: { ssh: { ip: "10.0.0.10", monitoringEnabled: true } },
                identityProfiles: { ssh: [11] },
                sectionEnabled: { ssh: { details: true, settings: true, identities: true } },
            }),
        },
        {
            id: 2,
            config: inheritanceConfig({
                profiles: { ssh: { port: 2222 } },
                sectionEnabled: { ssh: { details: true } },
            }),
        },
    ];

    const resolved = resolveProtocol(lineage, "ssh");

    assert.deepEqual(resolved.config, {
        ip: "10.0.0.10",
        port: 2222,
        monitoringEnabled: true,
    });
    assert.deepEqual(resolved.identities, [11]);
    assert.deepEqual(resolved.sectionSources.details, { state: "enabled", folderId: 2 });
    assert.deepEqual(resolved.sectionSources.settings, { state: "enabled", folderId: 1 });
});

test("a disabled child section clears inherited values without disabling other sections", () => {
    const lineage = [
        {
            id: 1,
            config: inheritanceConfig({
                profiles: { ssh: { ip: "10.0.0.10", monitoringEnabled: true } },
                sectionEnabled: { ssh: { details: true, settings: true } },
            }),
        },
        {
            id: 2,
            config: inheritanceConfig({
                sectionEnabled: { ssh: { details: false } },
            }),
        },
    ];

    const resolved = resolveProtocol(lineage, "ssh");

    assert.deepEqual(resolved.config, { monitoringEnabled: true });
    assert.deepEqual(resolved.sectionSources.details, { state: "disabled", folderId: 2 });
    assert.equal(getLocalSectionState(lineage[1].config.__nextermInheritance, "ssh", "settings"), "transparent");
});

test("descendant traversal stops only at true inheritance boundaries", () => {
    assert.equal(shouldTraverseChild("details", "transparent"), true);
    assert.equal(shouldTraverseChild("details", "enabled"), true);
    assert.equal(shouldTraverseChild("details", "disabled"), false);
    assert.equal(shouldTraverseChild("identities", "transparent"), true);
    assert.equal(shouldTraverseChild("identities", "enabled"), false);
    assert.equal(shouldTraverseChild("identities", "disabled"), false);
});

test("move impact prompts when inherited values change or an explicit override would be lost", () => {
    const baseSnapshot = {
        inheritance: {
            config: { ip: "10.0.0.10" },
            sectionSources: { details: { state: "enabled", folderId: 1 } },
        },
        localConfig: {},
    };

    assert.equal(configMoveRequiresChoice(baseSnapshot, {
        config: { ip: "10.0.0.20" },
        sectionSources: { details: { state: "enabled", folderId: 2 } },
    }, "details"), true);

    assert.equal(configMoveRequiresChoice({
        ...baseSnapshot,
        localConfig: { ip: "10.0.0.10" },
    }, {
        config: { ip: "10.0.0.10" },
        sectionSources: { details: { state: "enabled", folderId: 2 } },
    }, "details"), true);

    assert.equal(configMoveRequiresChoice(baseSnapshot, {
        config: { ip: "10.0.0.10" },
        sectionSources: { details: { state: "enabled", folderId: 2 } },
    }, "details"), false);

    assert.equal(configMoveRequiresChoice(baseSnapshot, {
        config: {},
        sectionSources: { details: { state: "disabled", folderId: 2 } },
    }, "details"), false);
});

test("inheritance transitions reject stale or invalid lifecycle decisions", () => {
    const current = { sectionEnabled: { ssh: { details: false } } };
    const next = { sectionEnabled: { ssh: { details: true } } };

    assert.equal(validateTransitions(current, next, []).code, 409);
    assert.equal(validateTransitions(current, next, [{
        protocol: "ssh",
        section: "details",
        from: "disabled",
        to: "enabled",
        policy: "invalid",
    }]).code, 400);

    const valid = validateTransitions(current, next, [{
        protocol: "ssh",
        section: "details",
        from: "disabled",
        to: "enabled",
        policy: "retain",
    }]);
    assert.equal(valid.code, undefined);
    assert.equal(valid.changes.length, 1);
});

test("move scope preserves every destination member's personal identity", () => {
    const memberAccounts = new Set([7, 8]);

    assert.equal(isIdentityAllowedForMove({ accountId: 7, organizationId: null }, 20, memberAccounts), true);
    assert.equal(isIdentityAllowedForMove({ accountId: 8, organizationId: null }, 20, memberAccounts), true);
    assert.equal(isIdentityAllowedForMove({ accountId: 9, organizationId: null }, 20, memberAccounts), false);
    assert.equal(isIdentityAllowedForMove({ accountId: null, organizationId: 20 }, 20, memberAccounts), true);
    assert.equal(isIdentityAllowedForMove({ accountId: null, organizationId: 21 }, 20, memberAccounts), false);
});

test("identity scope allows the actor's personal identities and only the matching organization", () => {
    assert.equal(isIdentityAllowedForScope({ accountId: 7, organizationId: null }, null, 7), true);
    assert.equal(isIdentityAllowedForScope({ accountId: 7, organizationId: null }, 20, 7), true);
    assert.equal(isIdentityAllowedForScope({ accountId: 8, organizationId: null }, 20, 7), false);
    assert.equal(isIdentityAllowedForScope({ accountId: null, organizationId: 20 }, 20, 7), true);
    assert.equal(isIdentityAllowedForScope({ accountId: null, organizationId: 21 }, 20, 7), false);
    assert.equal(isIdentityAllowedForScope({ accountId: null, organizationId: 20 }, null, 7), false);
});

test("server protocol changes are explicit and server location is reposition-only", () => {
    assert.equal(changesProtocol({ protocol: "ssh", ip: "old" }, { ip: "new" }), false);
    assert.equal(changesProtocol({ protocol: "ssh" }, { protocol: "ssh" }), false);
    assert.equal(changesProtocol({ protocol: "ssh" }, { protocol: "rdp" }), true);

    assert.equal(updateServerValidation.validate({ config: { ip: "10.0.0.20" } }).error, undefined);
    assert.equal(omitsProtocol({ ip: "10.0.0.20" }), true);
    assert.equal(omitsProtocol({ protocol: "ssh", ip: "10.0.0.20" }), false);
    assert.equal(omitsProtocol(undefined), false);
    assert.equal(updateServerValidation.validate({ config: { protocol: "ssh", ip: "10.0.0.20" } }).error, undefined);
    assert.ok(createServerValidation.validate({ name: "server", config: { ip: "10.0.0.20" } }).error);
    assert.ok(updateServerValidation.validate({ folderId: 2 }).error);
    assert.ok(updateServerValidation.validate({ organizationId: 3 }).error);
    assert.equal(repositionServerValidation.validate({ placement: "after", inheritancePolicy: "retain" }).error, undefined);
    assert.ok(repositionServerValidation.validate({ placement: "after", inheritancePolicy: "invalid" }).error);
});


test("legacy config profiles are normalized and modern values take precedence", () => {
    const inheritance = {
        config: { protocol: "ssh", ip: "10.0.0.10", port: 22 },
        profiles: { ssh: { port: 2222, monitoringEnabled: true } },
    };

    assert.deepEqual(getLocalProfiles(inheritance), {
        ssh: { ip: "10.0.0.10", port: 2222, monitoringEnabled: true },
    });
    assert.deepEqual(getLocalProfiles({ config: { port: 23 } }).telnet, { port: 23 });
});

test("security scopes require the same organization or personal owner", () => {
    assert.equal(isSameSecurityScope({ organizationId: 20, accountId: null }, { organizationId: 20, accountId: null }), true);
    assert.equal(isSameSecurityScope({ organizationId: 20, accountId: null }, { organizationId: 21, accountId: null }), false);
    assert.equal(isSameSecurityScope({ organizationId: null, accountId: 7 }, { organizationId: null, accountId: 7 }), true);
    assert.equal(isSameSecurityScope({ organizationId: null, accountId: 7 }, { organizationId: null, accountId: 8 }), false);
});

test("folder identity edits require unique numeric IDs and valid identity payloads", () => {
    assert.equal(folderEditValidation.validate({
        identityUpdates: [{ id: 7, config: { name: "Updated" } }],
    }).error, undefined);
    assert.ok(folderEditValidation.validate({
        identityUpdates: [{ id: 7, config: {} }],
    }).error);
    assert.ok(folderEditValidation.validate({
        identityUpdates: [
            { id: 7, config: { name: "One" } },
            { id: 7, config: { name: "Two" } },
        ],
    }).error);
});


test("effective config tracks inherited jump hosts without marking local overrides", () => {
    const inherited = mergeConfigWithProvenance(
        { jumpHosts: [11], monitoringEnabled: true },
        { protocol: "ssh", ip: "10.0.0.10" }
    );
    assert.deepEqual(inherited.config.jumpHosts, [11]);
    assert.equal(inherited.inheritedFields.has("jumpHosts"), true);

    const overridden = mergeConfigWithProvenance(
        { jumpHosts: [11] },
        { protocol: "ssh", jumpHosts: [12] }
    );
    assert.deepEqual(overridden.config.jumpHosts, [12]);
    assert.equal(overridden.inheritedFields.has("jumpHosts"), false);
});


test("inheritance lifecycle accepts the plain objects returned by configured model queries", () => {
    const plain = { id: 7, config: { value: "old" } };
    const modelLike = { toJSON: () => ({ id: 8, config: { value: "model" } }) };

    assert.deepEqual(toPlain(plain), plain);
    assert.deepEqual(toPlain(modelLike), { id: 8, config: { value: "model" } });
});


test("malformed inheritance payloads are rejected before resolution", () => {
    assert.equal(getInheritanceShapeError(null), null);
    assert.match(getInheritanceShapeError({ profiles: { ssh: null } }), /profiles/);
    assert.match(getInheritanceShapeError({ profiles: { smtp: {} } }), /unsupported protocol/);
    assert.match(getInheritanceShapeError({ sectionEnabled: { ssh: { details: "yes" } } }), /section state/);
    assert.match(getInheritanceShapeError(
        { identityProfiles: { ssh: [1, "2"] } },
        { allowEmbeddedIdentities: true }
    ), /numeric identity IDs/);
    assert.match(getInheritanceShapeError({ identityProfiles: { ssh: [1] } }), /saved separately/);
    assert.equal(getInheritanceShapeError(
        { identityProfiles: { ssh: [1] } },
        { allowEmbeddedIdentities: true }
    ), null);
    assert.equal(getInheritanceShapeError({
        profiles: { ssh: { ip: "10.0.0.1" } },
        sectionEnabled: { ssh: { details: true, settings: false, identities: false } },
    }), null);
});

test("legacy inheritance removal still requires matching lifecycle transitions", () => {
    const current = { config: { protocol: "ssh", ip: "10.0.0.1" } };

    assert.equal(validateTransitions(current, {}, []).code, 409);
    assert.deepEqual(validateTransitions(current, {}, [{
        protocol: "ssh",
        section: "details",
        from: "enabled",
        to: "transparent",
    }]).changes, [{
        protocol: "ssh",
        section: "details",
        from: "enabled",
        to: "transparent",
    }]);
});

test("temporary identities must have exactly one declared creation and be linked", () => {
    const profiles = { ssh: [4, "new-abc"] };
    const creates = [{ temporaryId: "new-abc", config: {} }];

    assert.equal(getTemporaryIdentityReferenceError(profiles, creates), null);
    assert.match(getTemporaryIdentityReferenceError(profiles, []), /unknown temporary identity/);
    assert.match(getTemporaryIdentityReferenceError({}, creates), /must be linked/);
});

test("identity authentication changes remove incompatible credentials", async () => {
    const originalDestroy = Credential.destroy;
    const destroyedTypes = [];
    Credential.destroy = async ({ where }) => destroyedTypes.push(where.type);

    try {
        await syncCredentials(9, "ssh", undefined, undefined, undefined);
        await syncCredentials(9, "password", undefined, undefined, undefined);
        await syncCredentials(9, "both", undefined, undefined, "");
    } finally {
        Credential.destroy = originalDestroy;
    }

    assert.deepEqual(destroyedTypes, [
        "password",
        { [require("sequelize").Op.in]: ["ssh-key", "passphrase"] },
        "passphrase",
    ]);
});

test("a replacement SSH key without a passphrase clears the old passphrase", async () => {
    const originals = { destroy: Credential.destroy, findOne: Credential.findOne, create: Credential.create };
    const destroyedTypes = [];
    Credential.destroy = async ({ where }) => destroyedTypes.push(where.type);
    Credential.findOne = async () => null;
    Credential.create = async () => ({});

    try {
        await syncCredentials(9, "ssh", undefined, "new-key", undefined);
    } finally {
        Object.assign(Credential, originals);
    }

    assert.ok(destroyedTypes.includes("passphrase"));
});

test("entry snapshots do not alias the live entry", async () => {
    const originalFindAll = EntryIdentity.findAll;
    EntryIdentity.findAll = async () => [];
    const entry = { id: 1, folderId: null, organizationId: 5, config: { protocol: "ssh" } };

    try {
        const snapshot = await snapshotEntry(entry);
        snapshot.entry.organizationId = 7;
    } finally {
        EntryIdentity.findAll = originalFindAll;
    }

    assert.equal(entry.organizationId, 5);
});

test("a shared cache resolves each folder lineage once", async () => {
    const originals = { findAll: Folder.findAll, profileFindAll: FolderIdentityProfile.findAll };
    let folderLookups = 0;
    Folder.findAll = async () => (folderLookups++, [{ id: 3, parentId: null, config: {} }, { id: 4, parentId: 3, config: {} }]);
    FolderIdentityProfile.findAll = async () => [];

    try {
        const cache = new Map();
        await Promise.all([getFolderInheritance(3, "ssh", { cache }), getFolderInheritance(4, "rdp", { cache })]);
    } finally {
        Folder.findAll = originals.findAll;
        FolderIdentityProfile.findAll = originals.profileFindAll;
    }

    assert.equal(folderLookups, 1);
});
