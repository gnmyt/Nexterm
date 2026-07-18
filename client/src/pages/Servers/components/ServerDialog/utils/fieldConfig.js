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
                    showRdpSecurity: true,
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
            case "demo":
                return {
                    showProtocol: false,
                    showIpPort: false,
                    showIdentities: false,
                    showSettings: false,
                    showMonitoring: false,
                    showKeyboardLayout: false,
                };
            case "sftp":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: false,
                    showTerminalSettings: false,
                    allowedAuthTypes: ["password", "ssh", "both"],
                    showWakeOnLan: true,
                };
            case "ftp":
            case "ftps":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
                    showSettings: true,
                    showMonitoring: false,
                    showKeyboardLayout: false,
                    showTerminalSettings: false,
                    allowedAuthTypes: ["password"],
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

    if (type === "pve-shell" || type === "pve-lxc") {
        return {
            showProtocol: false,
            showIpPort: false,
            showIdentities: false,
            showSettings: false,
            showMonitoring: false,
            showKeyboardLayout: false,
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

export const validateRequiredFields = (type, protocol, name, config) => {
    const fieldConfig = getFieldConfig(type, protocol);

    if (!name) return false;

    if (fieldConfig.showIpPort && (!config.ip || !config.port)) return false;

    if (fieldConfig.showProtocol && !config.protocol) return false;

    return true;
};
