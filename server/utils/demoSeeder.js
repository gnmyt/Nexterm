const fs = require("node:fs");
const Organization = require("../models/Organization");
const Folder = require("../models/Folder");
const Entry = require("../models/Entry");
const Identity = require("../models/Identity");
const EntryIdentity = require("../models/EntryIdentity");
const PermissionGroup = require("../models/PermissionGroup");
const GroupPermission = require("../models/GroupPermission");
const { syncCredentials } = require("../controllers/identity");
const registry = require("../permissions/registry");
const { DEMO_SETTINGS } = require("./demoMode");
const logger = require("./logger");

const { Permission: P } = registry;

const GUEST_GROUP_NAME = "Demo Guest";

const DEFAULT_GUEST_PERMISSIONS = [
    P.AUDIT_VIEW,
    P.SNIPPETS_MANAGE, P.SCRIPTS_MANAGE, P.SCRIPTS_EXECUTE,
    P.CONNECT_SSH, P.CONNECT_RDP, P.CONNECT_VNC,
    P.FILES_VIEW, P.FILES_DOWNLOAD,
];

const DEFAULT_GUEST_ORG_PERMISSIONS = [
    P.SCRIPTS_EXECUTE,
    P.CONNECT_SSH, P.CONNECT_RDP, P.CONNECT_VNC,
    P.FILES_VIEW, P.FILES_DOWNLOAD,
];

const NEVER_GRANTED = new Set([
    P.ORGANIZATIONS_CREATE, P.ORGANIZATIONS_MANAGE_ALL, P.PERMISSIONS_MANAGE, P.USERS_MANAGE, P.USERS_IMPERSONATE,
    P.SETTINGS_AUTH_PROVIDERS, P.SETTINGS_SOURCES, P.SETTINGS_ENGINES, P.SETTINGS_BACKUP, P.SETTINGS_AI,
    P.RESOURCES_MANAGE, P.IDENTITIES_MANAGE, P.CONNECT_TUNNEL, P.CONNECT_WEB,
    P.ORG_MANAGE, P.ORG_DELETE, P.ORG_MEMBERS_MANAGE, P.ORG_SESSIONS_VIEW, P.ORG_SESSIONS_CONTROL,
    P.ORG_AUDIT_RECORDINGS,
]);

const DEFAULT_CONFIG = {
    organizations: [{
        name: "Nexterm Demo",
        description: "Explore Nexterm with these demo connections",
        entries: [{ name: "Demo Desktop", icon: "server", protocol: "demo" }],
    }],
};

const PROTOCOL_RENDERERS = { ssh: "terminal", telnet: "terminal", rdp: "guac", vnc: "guac", demo: "guac", sftp: "sftp" };
const DEFAULT_PORTS = { ssh: 22, telnet: 23, rdp: 3389, vnc: 5900, sftp: 22 };

const loadDemoConfig = () => {
    const { configPath } = DEMO_SETTINGS;
    if (!fs.existsSync(configPath)) {
        logger.warn(`Demo config ${configPath} not found, seeding the built-in demo desktop only`);
        return DEFAULT_CONFIG;
    }
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
};

const resolvePermissions = (scope, defaults, overrides = {}) => {
    const values = new Map(registry[scope === registry.SCOPES.SYSTEM ? "allSystemIds" : "allOrgIds"]()
        .map(id => [id, defaults.includes(id) ? "allow" : "deny"]));

    for (const [permission, value] of Object.entries(overrides)) {
        if (!registry.isValidPermission(scope, permission)) throw new Error(`Unknown ${scope} permission in demo config: ${permission}`);
        if (value === "allow" && NEVER_GRANTED.has(permission)) throw new Error(`Demo guests may never be granted ${permission}`);
        if (value !== "allow" && value !== "deny") throw new Error(`Permission ${permission} must be "allow" or "deny"`);
        values.set(permission, value);
    }
    return values;
};

const seedGuestGroup = async (overrides) => {
    const [group] = await PermissionGroup.findOrCreate({
        where: { name: GUEST_GROUP_NAME },
        defaults: { color: "#F0962A", isDefault: false, isAdmin: false, sortOrder: 0 },
    });

    const permissions = resolvePermissions(registry.SCOPES.SYSTEM, DEFAULT_GUEST_PERMISSIONS, overrides);
    await GroupPermission.destroy({ where: { groupId: group.id } });
    await GroupPermission.bulkCreate([...permissions].map(([permission, value]) => ({ groupId: group.id, permission, value })));

    return group;
};

const upsertIdentity = async (organizationId, config) => {
    const type = config.type || (config.sshKey ? "ssh" : "password");
    const [identity] = await Identity.findOrCreate({
        where: { organizationId, name: config.name, entryId: null },
        defaults: { type, username: config.username, accountId: null },
    });
    await Identity.update({ type, username: config.username }, { where: { id: identity.id } });
    await syncCredentials(identity.id, type, config.password, config.sshKey, config.passphrase);
    return identity;
};

const upsertFolder = async (organizationId, name) => {
    const [folder] = await Folder.findOrCreate({
        where: { organizationId, name, parentId: null },
        defaults: { accountId: null },
    });
    return folder;
};

const upsertEntry = async (organizationId, config, identities, position) => {
    const protocol = config.protocol;
    if (!PROTOCOL_RENDERERS[protocol]) throw new Error(`Unsupported protocol "${protocol}" for demo entry ${config.name}`);

    const folderId = config.folder ? (await upsertFolder(organizationId, config.folder)).id : null;
    const entryConfig = { protocol, ...(config.config || {}) };
    if (protocol !== "demo") {
        if (!config.host) throw new Error(`Demo entry ${config.name} needs a host`);
        Object.assign(entryConfig, { ip: config.host, port: config.port || DEFAULT_PORTS[protocol] });
    }
    if (config.monitoring) entryConfig.monitoringEnabled = true;

    const values = {
        type: "server", renderer: PROTOCOL_RENDERERS[protocol], icon: config.icon || "server",
        folderId, position, config: entryConfig, accountId: null,
    };

    const existing = await Entry.findOne({ where: { organizationId, name: config.name } });
    if (existing) await Entry.update(values, { where: { id: existing.id } });
    const entry = existing || await Entry.create({ ...values, organizationId, name: config.name });

    await EntryIdentity.destroy({ where: { entryId: entry.id } });
    const identityKeys = [].concat(config.identity || config.identities || []);
    for (const [index, key] of identityKeys.entries()) {
        const identity = identities.get(key);
        if (!identity) throw new Error(`Demo entry ${config.name} references unknown identity "${key}"`);
        await EntryIdentity.create({ entryId: entry.id, identityId: identity.id, isDefault: index === 0 });
    }

    return entry;
};

const asObject = (value) => {
    if (typeof value !== "string") return value || {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};

const seedOrganization = async (config) => {
    if (!config.name) throw new Error("Every demo organization needs a name");

    let organization = await Organization.findOne({ where: { name: config.name } });
    if (!organization) organization = await Organization.create({ name: config.name });

    await Organization.update({
        description: config.description || null,
        auditSettings: { ...asObject(organization.auditSettings), enableSessionRecording: false, requireConnectionReason: false },
        sessionSettings: { ...asObject(organization.sessionSettings), enableLiveSessionSharing: false },
    }, { where: { id: organization.id } });

    const identities = new Map();
    for (const identityConfig of config.identities || []) {
        if (!identityConfig.key || !identityConfig.name) throw new Error("Demo identities need a key and a name");
        identities.set(identityConfig.key, await upsertIdentity(organization.id, identityConfig));
    }

    for (const [index, entryConfig] of (config.entries || []).entries())
        await upsertEntry(organization.id, entryConfig, identities, index);

    return {
        id: organization.id,
        permissions: resolvePermissions(registry.SCOPES.ORGANIZATION, DEFAULT_GUEST_ORG_PERMISSIONS, config.permissions),
    };
};

let seeded = null;

const seedDemo = async () => {
    const config = loadDemoConfig();
    if (!Array.isArray(config.organizations) || config.organizations.length === 0)
        throw new Error("The demo config needs at least one organization");

    const group = await seedGuestGroup(config.guestPermissions);
    const organizations = [];
    for (const organization of config.organizations) organizations.push(await seedOrganization(organization));

    seeded = { guestGroupId: group.id, organizations };
    logger.system("Demo mode prepared", { organizations: organizations.length, guestGroupId: group.id });
    return seeded;
};

const getSeededDemo = () => {
    if (!seeded) throw new Error("Demo mode has not been prepared");
    return seeded;
};

module.exports = { seedDemo, getSeededDemo, GUEST_GROUP_NAME };
