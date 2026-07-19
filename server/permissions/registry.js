const ADMIN_WILDCARD = "*";
const ADMIN_COLOR = "#a44747";

const SCOPES = { SYSTEM: "system", ORGANIZATION: "organization" };
const { SYSTEM, ORGANIZATION } = SCOPES;
const BOTH = [SYSTEM, ORGANIZATION];

const Permission = Object.freeze({
    USERS_VIEW: "users.view",
    USERS_MANAGE: "users.manage",
    USERS_IMPERSONATE: "users.impersonate",
    PERMISSIONS_MANAGE: "permissions.manage",
    ORGANIZATIONS_CREATE: "organizations.create",
    ORGANIZATIONS_MANAGE_ALL: "organizations.manage_all",
    AUDIT_VIEW: "audit.view",
    SETTINGS_AUTH_PROVIDERS: "settings.auth_providers",
    SETTINGS_SOURCES: "settings.sources",
    SETTINGS_ENGINES: "settings.engines",
    SETTINGS_MONITORING: "settings.monitoring",
    SETTINGS_BACKUP: "settings.backup",
    SETTINGS_AI: "settings.ai",

    RESOURCES_MANAGE: "resources.manage",
    IDENTITIES_MANAGE: "identities.manage",
    SNIPPETS_MANAGE: "snippets.manage",
    SCRIPTS_MANAGE: "scripts.manage",
    CONNECT_SSH: "connect.ssh",
    CONNECT_RDP: "connect.rdp",
    CONNECT_VNC: "connect.vnc",
    CONNECT_PROXMOX: "connect.proxmox",
    CONNECT_TUNNEL: "connect.tunnel",
    FILES_VIEW: "files.view",
    FILES_UPLOAD: "files.upload",
    FILES_DOWNLOAD: "files.download",
    FILES_MODIFY: "files.modify",
    SCRIPTS_EXECUTE: "scripts.execute",

    ORG_MANAGE: "org.manage",
    ORG_DELETE: "org.delete",
    ORG_MEMBERS_MANAGE: "org.members.manage",
    ORG_AUDIT_VIEW: "org.audit.view",
    ORG_AUDIT_RECORDINGS: "org.audit.recordings",
    ORG_SESSIONS_VIEW: "org.sessions.view",
    ORG_SESSIONS_CONTROL: "org.sessions.control",
});

const CATEGORIES = [
    { key: "users", label: "User Management", icon: "mdiAccountGroup" },
    { key: "permissions", label: "Roles & Permissions", icon: "mdiShieldKeyOutline" },
    { key: "organizations", label: "Organizations", icon: "mdiDomain" },
    { key: "auditing", label: "Auditing", icon: "mdiShieldCheckOutline" },
    { key: "settings", label: "Server Administration", icon: "mdiCogOutline" },
    { key: "resources", label: "Resources", icon: "mdiServerOutline" },
    { key: "connections", label: "Connections", icon: "mdiConsoleNetworkOutline" },
    { key: "files", label: "File Transfer", icon: "mdiFolderNetworkOutline" },
    { key: "general", label: "Organization", icon: "mdiDomain" },
    { key: "members", label: "Members", icon: "mdiAccountMultipleOutline" },
    { key: "audit", label: "Auditing", icon: "mdiShieldCheckOutline" },
    { key: "sessions", label: "Live Sessions", icon: "mdiMonitorShare" },
];

const P = Permission;
const PERMISSIONS = [
    { id: P.USERS_VIEW, scopes: [SYSTEM], category: "users", label: "View Users", description: "See the list of user accounts and their details." },
    { id: P.USERS_MANAGE, scopes: [SYSTEM], category: "users", label: "Manage Users", description: "Create, edit, delete users and reset their passwords." },
    { id: P.USERS_IMPERSONATE, scopes: [SYSTEM], category: "users", label: "Impersonate Users", description: "Start a session as another user for support purposes.", dangerous: true },

    { id: P.PERMISSIONS_MANAGE, scopes: [SYSTEM], category: "permissions", label: "Manage Roles & Permissions", description: "Create roles and assign permissions to users.", dangerous: true },

    { id: P.ORGANIZATIONS_CREATE, scopes: [SYSTEM], category: "organizations", label: "Create Organizations", description: "Create new organizations.", default: true },
    { id: P.ORGANIZATIONS_MANAGE_ALL, scopes: [SYSTEM], category: "organizations", label: "Manage All Organizations", description: "Administer every organization regardless of membership.", dangerous: true },

    { id: P.AUDIT_VIEW, scopes: [SYSTEM], category: "auditing", label: "Show Audit Log", description: "Access the audit log page and review activity history.", default: true },

    { id: P.SETTINGS_AUTH_PROVIDERS, scopes: [SYSTEM], category: "settings", label: "Authentication Providers", description: "Configure OIDC and LDAP identity providers." },
    { id: P.SETTINGS_SOURCES, scopes: [SYSTEM], category: "settings", label: "App Sources", description: "Manage application sources." },
    { id: P.SETTINGS_ENGINES, scopes: [SYSTEM], category: "settings", label: "Engines", description: "Manage connection engines." },
    { id: P.SETTINGS_MONITORING, scopes: [SYSTEM], category: "settings", label: "Monitoring", description: "Configure global monitoring settings." },
    { id: P.SETTINGS_BACKUP, scopes: [SYSTEM], category: "settings", label: "Backups", description: "Create, restore, export and import backups.", dangerous: true },
    { id: P.SETTINGS_AI, scopes: [SYSTEM], category: "settings", label: "AI Settings", description: "Configure the AI assistant integration." },

    { id: P.RESOURCES_MANAGE, scopes: BOTH, category: "resources", default: true, label: "Manage Resources", description: "Create, edit and delete servers and folders." },
    { id: P.IDENTITIES_MANAGE, scopes: BOTH, category: "resources", default: true, label: "Manage Identities", description: "Create, edit and delete identities." },
    { id: P.SNIPPETS_MANAGE, scopes: BOTH, category: "resources", default: true, label: "Manage Snippets", description: "Create, edit and delete command snippets." },
    { id: P.SCRIPTS_MANAGE, scopes: BOTH, category: "resources", default: true, label: "Manage Scripts", description: "Create, edit and delete scripts." },
    { id: P.SCRIPTS_EXECUTE, scopes: BOTH, category: "resources", default: true, label: "Execute Scripts", description: "Run scripts against servers." },

    { id: P.CONNECT_SSH, scopes: BOTH, category: "connections", default: true, label: "Connect via SSH / Telnet", description: "Open terminal sessions to servers." },
    { id: P.CONNECT_RDP, scopes: BOTH, category: "connections", default: true, label: "Connect via RDP", description: "Open remote desktop sessions to servers." },
    { id: P.CONNECT_VNC, scopes: BOTH, category: "connections", default: true, label: "Connect via VNC", description: "Open VNC sessions to servers." },
    { id: P.CONNECT_PROXMOX, scopes: BOTH, category: "connections", default: true, label: "Connect to Proxmox", description: "Open Proxmox VM, container and shell sessions." },
    { id: P.CONNECT_TUNNEL, scopes: BOTH, category: "connections", default: true, label: "Port Forwarding", description: "Create SSH tunnels and port forwards to servers." },

    { id: P.FILES_VIEW, scopes: BOTH, category: "files", default: true, label: "Browse Files", description: "Open the file manager and browse files over SFTP." },
    { id: P.FILES_UPLOAD, scopes: BOTH, category: "files", default: true, label: "Upload Files", description: "Upload files to servers." },
    { id: P.FILES_DOWNLOAD, scopes: BOTH, category: "files", default: true, label: "Download Files", description: "Download files and folders from servers." },
    { id: P.FILES_MODIFY, scopes: BOTH, category: "files", default: true, label: "Modify Files", description: "Create, rename, move, delete and change permissions of files.", dangerous: true },

    { id: P.ORG_MANAGE, scopes: [ORGANIZATION], category: "general", label: "Manage Organization", description: "Edit the organization name, description and settings." },
    { id: P.ORG_DELETE, scopes: [ORGANIZATION], category: "general", label: "Delete Organization", description: "Permanently delete this organization.", dangerous: true },
    { id: P.ORG_MEMBERS_MANAGE, scopes: [ORGANIZATION], category: "members", label: "Manage Members", description: "Invite, remove and assign permissions to members." },

    { id: P.ORG_AUDIT_VIEW, scopes: [ORGANIZATION], category: "audit", label: "View Audit Logs", description: "View audit logs and configure auditing for this organization." },
    { id: P.ORG_AUDIT_RECORDINGS, scopes: [ORGANIZATION], category: "audit", label: "Play Session Recordings", description: "Download and play back recorded sessions.", dangerous: true },

    { id: P.ORG_SESSIONS_VIEW, scopes: [ORGANIZATION], category: "sessions", label: "View Live Sessions", description: "See the running sessions of other members and join them read-only." },
    { id: P.ORG_SESSIONS_CONTROL, scopes: [ORGANIZATION], category: "sessions", label: "Control Live Sessions", description: "Send input to the sessions of other members after joining them.", dangerous: true },
];

const byId = new Map(PERMISSIONS.map((p) => [p.id, p]));
const forScope = (scope) => PERMISSIONS.filter((p) => p.scopes.includes(scope));

const isValidPermission = (scope, id) => !!byId.get(id)?.scopes.includes(scope);

const getDefaultPermissions = (scope) => forScope(scope).filter((p) => p.default).map((p) => p.id);

const buildCatalog = (scope) => {
    const permissions = forScope(scope);
    const used = new Set(permissions.map((p) => p.category));
    return { scope, categories: CATEGORIES.filter((c) => used.has(c.key)), permissions };
};

module.exports = {
    ADMIN_WILDCARD,
    ADMIN_COLOR,
    SCOPES,
    Permission,
    isValidPermission,
    getDefaultPermissions,
    buildCatalog,
    allSystemIds: () => forScope(SCOPES.SYSTEM).map((p) => p.id),
    allOrgIds: () => forScope(SCOPES.ORGANIZATION).map((p) => p.id),
};
