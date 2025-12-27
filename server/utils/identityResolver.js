const Identity = require('../models/Identity');
const EntryIdentity = require('../models/EntryIdentity');
const { listIdentities } = require('../controllers/identity');

const resolveIdentity = async (entry, identityId, directIdentity = null, accountId = null) => {
    const isPveEntry = entry.type?.startsWith('pve-');
    const isTelnet = entry.type === 'telnet' || (entry.type === 'server' && entry.config?.protocol === 'telnet');

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

    if (identityId) {
        const identity = await Identity.findByPk(identityId);
        if (!identity) return { identity: null, requiresIdentity: !isPveEntry && !isTelnet };
        if (accessibleIds && !accessibleIds.has(identity.id)) {
            return { identity: null, requiresIdentity: !isPveEntry && !isTelnet, accessDenied: true };
        }
        return identity;
    }

    const entryIdentities = await EntryIdentity.findAll({
        where: { entryId: entry.id },
        order: [['isDefault', 'DESC']]
    });

    for (const ei of entryIdentities) {
        if (accessibleIds && !accessibleIds.has(ei.identityId)) continue;
        const identity = await Identity.findByPk(ei.identityId);
        if (identity) return identity;
    }

    return { identity: null, requiresIdentity: !isPveEntry && !isTelnet };
};

module.exports = { resolveIdentity };
