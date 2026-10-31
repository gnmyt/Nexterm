const test = require("node:test");
const assert = require("node:assert/strict");
const migration = require("../migrations/0042-add-folder-identity-profiles");

const inheritanceConfig = (inheritance) => JSON.stringify({ __nextermInheritance: inheritance });

test("folder identity migration is transactional, normalizes profiles, and filters identities by scope", async () => {
    const transaction = { id: "migration-transaction" };
    const updates = [];
    let insertedRows = [];
    const folders = [
        {
            id: 10,
            accountId: 7,
            organizationId: null,
            config: inheritanceConfig({
                config: { protocol: "ssh", ip: "legacy", port: 22 },
                profiles: { ssh: { port: 2222 } },
                identityProfiles: { ssh: [1, 2, 3] },
            }),
        },
        {
            id: 20,
            accountId: null,
            organizationId: 30,
            config: inheritanceConfig({
                config: { monitoringEnabled: true },
                identityProfiles: { ssh: [3, 4, 5, 6] },
                sectionEnabled: { ssh: { identities: false } },
            }),
        },
    ];
    const identities = [
        { id: 1, accountId: 7, organizationId: null },
        { id: 2, accountId: 8, organizationId: null },
        { id: 3, accountId: null, organizationId: 30 },
        { id: 4, accountId: null, organizationId: 31 },
        { id: 5, accountId: 8, organizationId: null },
        { id: 6, accountId: 9, organizationId: null },
    ];
    const memberships = [{ organizationId: 30, accountId: 8 }];
    let transactionUsed = false;

    const queryInterface = {
        sequelize: {
            transaction: async (callback) => {
                transactionUsed = true;
                return callback(transaction);
            },
            query: async (sql, options) => {
                assert.equal(options.transaction, transaction);
                if (sql.includes("FROM folders")) return folders;
                if (sql.includes("FROM identities")) return identities;
                if (sql.includes("FROM organization_members")) return memberships;
                throw new Error(`Unexpected query: ${sql}`);
            },
        },
        createTable: async (name, columns, options) => assert.equal(options.transaction, transaction),
        addIndex: async (name, columns, options) => assert.equal(options.transaction, transaction),
        bulkUpdate: async (table, values, where, options) => {
            assert.equal(options.transaction, transaction);
            updates.push({ values, where });
        },
        bulkInsert: async (table, rows, options) => {
            assert.equal(options.transaction, transaction);
            insertedRows = rows;
        },
    };

    await migration.up(queryInterface);

    assert.equal(transactionUsed, true);
    assert.deepEqual(insertedRows.map(({ folderId, identityId, accountId }) => ({ folderId, identityId, accountId })), [
        { folderId: 10, identityId: 1, accountId: 7 },
        { folderId: 20, identityId: 3, accountId: null },
        { folderId: 20, identityId: 5, accountId: 8 },
    ]);

    const personalConfig = JSON.parse(updates.find((update) => update.where.id === 10).values.config).__nextermInheritance;
    assert.equal(personalConfig.config, undefined);
    assert.deepEqual(personalConfig.profiles.ssh, { ip: "legacy", port: 2222 });

    const organizationConfig = JSON.parse(updates.find((update) => update.where.id === 20).values.config).__nextermInheritance;
    assert.equal(organizationConfig.sectionEnabled.ssh.identities, false);
    assert.equal(organizationConfig.config, undefined);
    assert.deepEqual(organizationConfig.profiles.rdp, { monitoringEnabled: true });
});
