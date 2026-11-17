const { after, test } = require("node:test");
const assert = require("node:assert/strict");

const database = require("../utils/database");
const PermissionGroup = require("../models/PermissionGroup");
const GroupPermission = require("../models/GroupPermission");
const GroupMember = require("../models/GroupMember");
const Account = require("../models/Account");
const { addGroupMember, setUserGroups } = require("../controllers/permission");

after(async () => {
    await database.close();
});

const withStubs = async (stubs, run) => {
    const originals = stubs.map(([target, name, fn]) => {
        const original = target[name];
        target[name] = fn;
        return () => { target[name] = original; };
    });
    try {
        return await run();
    } finally {
        originals.forEach((restore) => restore());
    }
};

const customGroup = { id: 7, isAdmin: false, isDefault: false };
const impersonators = [{ groupId: 7, permission: "users.impersonate", value: "allow" }];
const limitedCaller = { isAdmin: false, permissions: ["permissions.manage"] };
const capableCaller = { isAdmin: false, permissions: ["permissions.manage", "users.impersonate"] };

test("adding a member to a group that grants more than the caller holds is refused", async () => {
    let created = false;
    const result = await withStubs([
        [PermissionGroup, "findByPk", async () => customGroup],
        [GroupPermission, "findAll", async () => impersonators],
        [Account, "findByPk", async () => ({ id: 2 })],
        [GroupMember, "findOrCreate", async () => { created = true; }],
    ], () => addGroupMember(7, 2, limitedCaller));

    assert.equal(result.code, 403);
    assert.equal(created, false);
});

test("adding a member is allowed when the caller holds every permission the group grants", async () => {
    let created = false;
    const result = await withStubs([
        [PermissionGroup, "findByPk", async () => customGroup],
        [GroupPermission, "findAll", async () => impersonators],
        [Account, "findByPk", async () => ({ id: 2 })],
        [GroupMember, "findOrCreate", async () => { created = true; }],
    ], () => addGroupMember(7, 2, capableCaller));

    assert.deepEqual(result, { success: true });
    assert.equal(created, true);
});

test("setting user groups only checks the ceiling for newly added groups", async () => {
    let queriedGroupIds = null;
    let destroyed = false;
    const result = await withStubs([
        [Account, "findByPk", async () => ({ id: 2 })],
        [PermissionGroup, "findAll", async ({ where }) => where.isAdmin ? [] : [customGroup, { id: 8, isAdmin: false, isDefault: false }]],
        [GroupPermission, "findAll", async ({ where }) => {
            queriedGroupIds = where.groupId[Object.getOwnPropertySymbols(where.groupId)[0]];
            return impersonators;
        }],
        [GroupMember, "findAll", async () => [{ groupId: 7 }]],
        [GroupMember, "destroy", async () => { destroyed = true; }],
    ], () => setUserGroups(2, [7, 8], limitedCaller));

    assert.deepEqual(queriedGroupIds, [8]);
    assert.equal(destroyed, false);
    assert.equal(result.code, 403);
});
