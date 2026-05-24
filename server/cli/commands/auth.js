const LDAPProvider = require("../../models/LDAPProvider");
const OIDCProvider = require("../../models/OIDCProvider");
const { table, restartHint, yn } = require("../utils");

const INTERNAL_ALIASES = new Set(["internal", "local"]);
const isInternal = (s) => INTERNAL_ALIASES.has(s.toLowerCase());

const findLdap = (selector) => LDAPProvider.findOne({
    where: /^\d+$/.test(selector) ? { id: Number(selector) } : { name: selector },
});

const setInternal = (enabled) => OIDCProvider.update({ enabled }, { where: { isInternal: true } });
const setLdap = (enabled, where = {}) => LDAPProvider.update({ enabled }, { where });
const setOidcExternal = (enabled) => OIDCProvider.update({ enabled }, { where: { isInternal: false } });

const disableAll = () => Promise.all([setInternal(false), setLdap(false), setOidcExternal(false)]);

const countEnabled = async ({ includeInternal } = { includeInternal: false }) => {
    const where = includeInternal ? { enabled: true } : { enabled: true, isInternal: false };
    return await LDAPProvider.count({ where: { enabled: true } }) + await OIDCProvider.count({ where });
};

module.exports.list = async () => {
    const [internal, ldaps, oidcs] = await Promise.all([
        OIDCProvider.findOne({ where: { isInternal: true } }),
        LDAPProvider.findAll({ order: [["id", "ASC"]] }),
        OIDCProvider.findAll({ where: { isInternal: false }, order: [["id", "ASC"]] }),
    ]);
    const rows = [];
    if (internal) rows.push({ kind: "internal", id: internal.id, name: "internal (local)", enabled: yn(internal.enabled) });
    for (const p of ldaps) rows.push({ kind: "ldap", id: p.id, name: p.name, enabled: yn(p.enabled) });
    for (const p of oidcs) rows.push({ kind: "oidc", id: p.id, name: p.name, enabled: yn(p.enabled) });
    table(rows, ["kind", "id", "name", "enabled"]);
};

module.exports.enable = async (selector) => {
    if (isInternal(selector)) {
        await disableAll();
        await setInternal(true);
        console.log("enabled internal (local) authentication; disabled all other providers");
        return restartHint();
    }
    const ldap = await findLdap(selector);
    if (!ldap) throw new Error(`no provider matched '${selector}'`);
    await disableAll();
    await setLdap(true, { id: ldap.id });
    console.log(`enabled LDAP provider '${ldap.name}' (id=${ldap.id}); disabled all other providers`);
    restartHint();
};

module.exports.disable = async (selector) => {
    if (isInternal(selector)) {
        if (await countEnabled() === 0)
            throw new Error("refusing to disable internal auth: no other provider is enabled");
        await setInternal(false);
        console.log("disabled internal (local) authentication");
        return restartHint();
    }
    const ldap = await findLdap(selector);
    if (!ldap) throw new Error(`no LDAP provider matched '${selector}'`);
    await setLdap(false, { id: ldap.id });
    console.log(`disabled LDAP provider '${ldap.name}' (id=${ldap.id})`);

    if (await countEnabled({ includeInternal: true }) === 0) {
        await setInternal(true);
        console.log("no providers remained enabled - re-enabled internal (local) authentication");
    }
    restartHint();
};
