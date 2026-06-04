const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ENCRYPTION_KEY ||= "0".repeat(64);

const OIDCProvider = require("../models/OIDCProvider");
const LDAPProvider = require("../models/LDAPProvider");
const { decrypt } = require("../utils/encryption");
const oidc = require("../controllers/oidc");
const ldap = require("../controllers/ldap");

const captureUpdates = (Model, existing) => {
    const originals = { findByPk: Model.findByPk, update: Model.update };
    const updates = [];
    Model.findByPk = async () => existing;
    Model.update = async (data, options) => updates.push({ data, options });
    return { updates, restore: () => Object.assign(Model, originals) };
};

test("OIDC provider updates store an encrypted client secret", async () => {
    const { updates, restore } = captureUpdates(OIDCProvider, { id: 3, enabled: true, isInternal: false });
    try {
        await oidc.updateProvider(3, { clientSecret: "new-secret" });
    } finally {
        restore();
    }

    const { data } = updates.at(-1);
    assert.notEqual(data.clientSecret, "new-secret");
    assert.equal(decrypt(data.clientSecret, data.clientSecretIV, data.clientSecretAuthTag), "new-secret");
});

test("OIDC provider updates keep the stored secret when the placeholder is sent", async () => {
    const { updates, restore } = captureUpdates(OIDCProvider, { id: 3, enabled: true, isInternal: false });
    try {
        await oidc.updateProvider(3, { name: "Renamed", clientSecret: "********" });
    } finally {
        restore();
    }

    const { data } = updates.at(-1);
    assert.equal(data.name, "Renamed");
    assert.equal(Object.hasOwn(data, "clientSecret"), false);
    assert.equal(Object.hasOwn(data, "clientSecretIV"), false);
    assert.equal(Object.hasOwn(data, "clientSecretAuthTag"), false);
});

test("LDAP provider updates store an encrypted bind password", async () => {
    const { updates, restore } = captureUpdates(LDAPProvider, { id: 4, enabled: true });
    try {
        await ldap.updateProvider(4, { bindPassword: "bind-secret" });
    } finally {
        restore();
    }

    const { data } = updates.at(-1);
    assert.notEqual(data.bindPassword, "bind-secret");
    assert.equal(decrypt(data.bindPassword, data.bindPasswordIV, data.bindPasswordAuthTag), "bind-secret");
});

test("LDAP provider updates keep the stored password when the placeholder is sent", async () => {
    const { updates, restore } = captureUpdates(LDAPProvider, { id: 4, enabled: true });
    try {
        await ldap.updateProvider(4, { host: "ldap.example.com", bindPassword: "********" });
    } finally {
        restore();
    }

    const { data } = updates.at(-1);
    assert.equal(data.host, "ldap.example.com");
    assert.equal(Object.hasOwn(data, "bindPassword"), false);
});
