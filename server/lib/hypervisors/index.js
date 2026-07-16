const proxmox = require("./proxmox");

const providers = {
    [proxmox.type]: proxmox,
};

const getProvider = (type) => providers[type] || null;

const entryKey = (entry) => {
    const config = entry.config || {};
    const providerId = config.providerId
        || (entry.type === "pve-shell" ? "shell" : config.vmid != null ? String(config.vmid) : "unknown");
    return `${config.nodeName ?? ""}::${providerId}`;
};

module.exports = { getProvider, entryKey };
