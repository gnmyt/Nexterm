const test = require("node:test");
const assert = require("node:assert/strict");

const {
    extractGroupClaim,
    mergeOIDCClaims,
    resolveMappedRoles,
    syncOrganizationMemberships,
} = require("../utils/oidcGroupSync");

test("uses ID-token groups when userinfo omits the configured claim", () => {
    const claims = mergeOIDCClaims(
        { sub: "account-1", groups: ["operators", "nexterm-users"] },
        { sub: "account-1", preferred_username: "alice" },
    );

    assert.deepEqual(extractGroupClaim(claims, "groups"), ["operators", "nexterm-users"]);
});

test("userinfo group claims override the ID-token claim when both are present", () => {
    const claims = mergeOIDCClaims(
        { groups: ["from-token"] },
        { groups: "from-userinfo, second-group" },
    );

    assert.deepEqual(extractGroupClaim(claims, "groups"), ["from-userinfo", "second-group"]);
});

test("owner mappings take precedence for the same organization", () => {
    const roles = resolveMappedRoles(["member-group", "owner-group"], [
        { value: "owner-group", organizationId: 7, role: "owner" },
        { value: "member-group", organizationId: 7, role: "member" },
    ]);

    assert.equal(roles.get(7), "owner");
});

test("removes stale managed memberships when no mappings remain", async () => {
    const destroyedMemberships = [];
    const destroyedPermissions = [];
    const revoked = [];
    const logs = [];

    await syncOrganizationMemberships(3, [], { groupMappings: [] }, {
        organizationModel: {
            findByPk: async () => {
                throw new Error("No organization lookup expected without matching mappings");
            },
        },
        memberModel: {
            findOrCreate: async () => {
                throw new Error("No membership creation expected without matching mappings");
            },
            update: async () => {
                throw new Error("No membership update expected without matching mappings");
            },
            findAll: async () => [
                { organizationId: 11, accountId: 3, role: "member", managedByOidc: true },
            ],
            destroy: async options => destroyedMemberships.push(options.where),
        },
        permissionModel: {
            destroy: async options => destroyedPermissions.push(options.where),
        },
        revokeAccess: (organizationId, accountId) => revoked.push({ organizationId, accountId }),
        logger: {
            system: (message, data) => logs.push({ message, data }),
        },
    });

    assert.deepEqual(destroyedMemberships, [{ organizationId: 11, accountId: 3 }]);
    assert.deepEqual(destroyedPermissions, [{ organizationId: 11, accountId: 3 }]);
    assert.deepEqual(revoked, [{ organizationId: 11, accountId: 3 }]);
    assert.equal(logs.length, 1);
});
