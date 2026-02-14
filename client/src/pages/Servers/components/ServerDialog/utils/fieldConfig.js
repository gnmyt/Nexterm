import { mdiInformationOutline, mdiAccountKeyOutline, mdiCogOutline } from "@mdi/js";

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
                    showTerminalSettings: true,
                    allowedAuthTypes: ["password", "ssh", "both"],
                    showWakeOnLan: true,
                };
            case "telnet":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: false,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: false,
                    showTerminalSettings: true,
                    showWakeOnLan: true,
                };
            case "rdp":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: true,
                    showDisplaySettings: true,
                    showPerformanceSettings: true,
                    showAudioSettings: true,
                    allowedAuthTypes: ["password-only", "password"],
                    showWakeOnLan: true,
                };
            case "vnc":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: false,
                    showDisplaySettings: true,
                    showAudioSettings: true,
                    allowedAuthTypes: ["password-only", "password"],
                    showWakeOnLan: true,
                };
            default:
                return {
                    showProtocol: true,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: true,
                    showKeyboardLayout: true,
                    allowedAuthTypes: ["password", "ssh", "both"],
                    showWakeOnLan: true,
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
            showKeyboardLayout: false,
            showDisplaySettings: true,
            showAudioSettings: true,
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

    tabs.push({ key: "details", label: "servers.dialog.tabs.details", icon: mdiInformationOutline });

    if (config.showIdentities) {
        tabs.push({ key: "identities", label: "servers.dialog.tabs.identities", icon: mdiAccountKeyOutline });
    }

    if (config.showSettings && (config.showMonitoring || config.showKeyboardLayout || config.showDisplaySettings || config.showAudioSettings || config.showWakeOnLan || config.showTerminalSettings)) {
        tabs.push({ key: "settings", label: "servers.dialog.tabs.settings", icon: mdiCogOutline });
    }

    return tabs;
};

export const getRequiredFieldErrors = (type, protocol, name, config) => {
    const fieldConfig = getFieldConfig(type, protocol);
    const errors = {};

    if (!name) errors.name = true;

    if (fieldConfig.showIpPort) {
        if (!config.ip) errors.ip = true;
        if (!config.port) errors.port = true;
    }

    if (fieldConfig.showProtocol && !config.protocol) errors.protocol = true;

    if (fieldConfig.showPveConfig && fieldConfig.pveFields) {
        for (const field of fieldConfig.pveFields) {
            if (field === "vmid" && !config[field]) errors.vmid = true;
        }
    }

    return errors;
};

export const validateRequiredFields = (type, protocol, name, config) => {
    const errors = getRequiredFieldErrors(type, protocol, name, config);
    return Object.keys(errors).length === 0;
};
