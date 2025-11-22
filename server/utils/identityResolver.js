const Identity = require('../models/Identity');
const EntryIdentity = require('../models/EntryIdentity');

const resolveIdentity = async (entry, identityId) => {
    const isPveEntry = entry.type?.startsWith('pve-');
    const isTelnet = entry.type === 'telnet' || (entry.type === 'server' && entry.config?.protocol === 'telnet');

    if (identityId) {
        const identity = await Identity.findByPk(identityId);
        if (identity) return identity;
        return { identity: null, requiresIdentity: !isPveEntry && !isTelnet };
    }

    const entryIdentities = await EntryIdentity.findAll({
        where: { entryId: entry.id },
        order: [['isDefault', 'DESC']]
    });

    if (entryIdentities.length > 0) {
        const identity = await Identity.findByPk(entryIdentities[0].identityId);
        if (identity) return identity;
    }

    return { identity: null, requiresIdentity: !isPveEntry && !isTelnet };
};

module.exports = { resolveIdentity };
