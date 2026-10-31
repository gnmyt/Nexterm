const Identity = require('../models/Identity');
const { listIdentities } = require("../controllers/identity");
const { getEntryIdentityIds, withoutInheritance } = require("./folderInheritance");
const { getEntryScope, isIdentityAllowedForScope } = require("./resourceValidation");

const CREDENTIALLESS_PROTOCOLS = ['telnet', 'demo'];

const resolveIdentity = async (entry, identityId, directIdentity = null, accountId = null, options = {}) => {
    const protocol = entry.type === "server" ? withoutInheritance(entry.config).protocol : entry.type;
    const requiresIdentity = !entry.type?.startsWith('pve-') && !CREDENTIALLESS_PROTOCOLS.includes(protocol);

    if (directIdentity) {
        return {
            id: null,
            name: 'Direct Connection',
            username: directIdentity.username,
            type: directIdentity.type,
            isDirect: true,
            directCredentials: {
                password: directIdentity.password,
                "ssh-key": directIdentity.sshKey,
                passphrase: directIdentity.passphrase
            }
        };
    }

    const accessibleIds = accountId ? new Set((await listIdentities(accountId)).map(i => i.id)) : null;
    const scope = accountId ? await getEntryScope(entry) : null;

    if (identityId) {
        const identity = await Identity.findByPk(identityId);
        if (!identity) return { identity: null, requiresIdentity };
        if (accessibleIds && (!accessibleIds.has(identity.id)
            || !isIdentityAllowedForScope(identity, scope.organizationId, accountId))) {
            return { identity: null, requiresIdentity, accessDenied: true };
        }
        return identity;
    }

    const entryIdentityIds = await getEntryIdentityIds(entry, { ...options, ...(accountId ? { accountId } : {}) });

    for (const entryIdentityId of entryIdentityIds) {
        if (accessibleIds && !accessibleIds.has(entryIdentityId)) continue;
        const identity = await Identity.findByPk(entryIdentityId);
        if (identity && (!scope || isIdentityAllowedForScope(identity, scope.organizationId, accountId))) return identity;
    }

    return { identity: null, requiresIdentity };
};

module.exports = { resolveIdentity };
