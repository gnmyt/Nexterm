export const getFieldConfig = (type, protocol) => {
    if (type === "server") {
        switch (protocol) {
            case "ssh":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: true,
                    showKeyboardLayout: false,
                };
            case "telnet":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: false,
                    showSettings: false,
                    showMonitoring: false,
                    showKeyboardLayout: false,
                };
            case "rdp":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: true,
                };
            case "vnc":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: true,
                };
            default:
                return {
                    showProtocol: true,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: true,
                    showKeyboardLayout: true,
                };
        }
    }

    if (type === "pve-shell") {
        return {
            showProtocol: false,
            showIpPort: false,
            showIdentities: false,
            showSettings: false,
            showMonitoring: false,
            showKeyboardLayout: false,
            showPveConfig: true,
            pveFields: ["nodeName"],
        };
    }

    if (type === "pve-lxc") {
        return {
            showProtocol: false,
            showIpPort: false,
            showIdentities: false,
            showSettings: false,
            showMonitoring: false,
            showKeyboardLayout: false,
            showPveConfig: true,
            pveFields: ["nodeName", "vmid"],
        };
    }

    if (type === "pve-qemu") {
        return {
            showProtocol: false,
            showIpPort: false,
            showIdentities: false,
            showSettings: true,
            showMonitoring: false,
            showKeyboardLayout: true,
            showPveConfig: true,
            pveFields: ["nodeName", "vmid"],
        };
    }

    return {
        showProtocol: true,
        showIpPort: true,
        showIdentities: true,
        showSettings: true,
        showMonitoring: true,
        showKeyboardLayout: false,
    };
};

export const getAvailableTabs = (type, protocol) => {
    const config = getFieldConfig(type, protocol);
    const tabs = [];

    tabs.push({ key: "details", label: "servers.dialog.tabs.details" });

    if (config.showIdentities) {
        tabs.push({ key: "identities", label: "servers.dialog.tabs.identities" });
    }

    if (config.showSettings && (config.showMonitoring || config.showKeyboardLayout)) {
        tabs.push({ key: "settings", label: "servers.dialog.tabs.settings" });
    }

    return tabs;
};

export const validateRequiredFields = (type, protocol, name, config) => {
    const fieldConfig = getFieldConfig(type, protocol);

    if (!name) return false;

    if (fieldConfig.showIpPort && (!config.ip || !config.port)) return false;

    if (fieldConfig.showProtocol && !config.protocol) return false;

    if (fieldConfig.showPveConfig && fieldConfig.pveFields) {
        for (const field of fieldConfig.pveFields) {
            if (field === "vmid" && !config[field]) return false;
        }
    }

    return true;
};
