const net = require("node:net");

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const addPrincipal = (principals, value) => {
    const principal = String(value || "").trim();
    if (!principal) return;
    if (principal.length > 128) throw new Error("SSH principal is too long");
    if (/[\u0000-\u0008\u000e-\u001f\s,]/.test(principal)) throw new Error("SSH principal contains invalid characters");
    if (!principals.includes(principal)) principals.push(principal);
};

const resolvePrincipals = ({ username, groups = [], groupPrincipalMappings = [], extraPrincipals = [] }) => {
    const principals = [];
    addPrincipal(principals, username);
    const groupSet = new Set(asArray(groups).map(String));
    for (const mapping of asArray(groupPrincipalMappings)) {
        if (!mapping || !groupSet.has(String(mapping.group))) continue;
        for (const principal of asArray(mapping.principals)) addPrincipal(principals, principal);
    }
    for (const principal of asArray(extraPrincipals)) addPrincipal(principals, principal);
    if (!principals.length) throw new Error("A username or principal is required to issue an SSH certificate");
    if (principals.length > 32) throw new Error("Too many SSH principals");
    return principals;
};

const renderKeyId = (template, values) => {
    const rendered = String(template || "{{username}}")
        .replaceAll("{{username}}", values.username || "")
        .replaceAll("{{account}}", values.account || "")
        .replaceAll("{{subject}}", values.subject || "")
        .replaceAll("{{server}}", values.server || "")
        .replaceAll("{{host}}", values.host || "")
        .trim();
    const keyId = rendered || values.username || "nexterm";
    if (keyId.length > 128 || /[\u0000-\u001f]/.test(keyId)) throw new Error("SSH certificate key id is invalid");
    return keyId;
};

const clampTtl = (ttlSeconds) => {
    const value = Number(ttlSeconds);
    if (!Number.isFinite(value)) return 300;
    return Math.min(86400, Math.max(30, Math.floor(value)));
};

const namedList = (value) => asArray(value).map((item) => String(item || "").trim()).filter(Boolean);

const listMatches = (list, value) => {
    const items = namedList(list);
    if (!items.length) return true;
    return items.includes(String(value || "").trim());
};

const authorityIsSelectable = (authority) => Boolean(
    authority?.organizationId
    || namedList(authority?.selectorGroups).length
    || namedList(authority?.domains).length
    || namedList(authority?.environments).length
);

const authorityMatches = (authority, { account, entry } = {}) => {
    if (!authority || authority.enabled === false) return false;
    if (authority.organizationId && Number(authority.organizationId) !== Number(entry?.organizationId)) return false;
    const groups = new Set(namedList(account?.oidcGroups));
    const selectorGroups = namedList(authority.selectorGroups);
    if (selectorGroups.length && !selectorGroups.some((group) => groups.has(group))) return false;
    if (!listMatches(authority.domains, entry?.config?.domain)) return false;
    if (!listMatches(authority.environments, entry?.config?.environment)) return false;
    return true;
};

const specificity = (authority) => (
    (authority.organizationId ? 4 : 0)
    + (namedList(authority.selectorGroups).length ? 2 : 0)
    + (namedList(authority.domains).length ? 2 : 0)
    + (namedList(authority.environments).length ? 2 : 0)
);

const selectAuthority = (authorities, context) => {
    const matches = asArray(authorities)
        .filter((authority) => authorityIsSelectable(authority) && authorityMatches(authority, context))
        .sort((left, right) => specificity(right) - specificity(left) || Number(left.id) - Number(right.id));
    return matches[0] || null;
};

const resolveTtl = ({ ca, account, entry }) => {
    if (entry?.config?.sshCertTtl) return clampTtl(entry.config.sshCertTtl);
    const groups = new Set(namedList(account?.oidcGroups));
    const groupTtls = asArray(ca?.ttlByGroup)
        .filter((item) => item && groups.has(String(item.group)))
        .map((item) => clampTtl(item.ttlSeconds));
    if (groupTtls.length) return Math.min(...groupTtls);
    const environment = String(entry?.config?.environment || "").trim();
    const environmentTtl = asArray(ca?.ttlByEnvironment).find((item) => String(item?.environment) === environment);
    if (environment && environmentTtl) return clampTtl(environmentTtl.ttlSeconds);
    return clampTtl(ca?.ttlSeconds);
};

const normalizeSourceAddress = (value) => {
    if (!value) return null;
    const parts = String(value).split(",").map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    return parts.map((part) => {
        const [address, prefix] = part.split("/");
        const version = net.isIP(address);
        if (!version || part.split("/").length > 2) throw new Error("SSH certificate source address is invalid");
        const defaultBits = version === 4 ? 32 : 128;
        const bits = prefix === undefined ? defaultBits : Number(prefix);
        const max = version === 4 ? 32 : 128;
        if (!Number.isInteger(bits) || bits < 0 || bits > max) throw new Error("SSH certificate source address is invalid");
        return `${address}/${bits}`;
    }).join(",");
};

module.exports = {
    asArray,
    resolvePrincipals,
    renderKeyId,
    clampTtl,
    normalizeSourceAddress,
    authorityMatches,
    selectAuthority,
    resolveTtl,
};
