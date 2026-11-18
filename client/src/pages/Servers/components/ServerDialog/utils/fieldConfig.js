import { mdiInformationOutline, mdiAccountKeyOutline, mdiLanConnect, mdiTuneVariant, mdiMonitorDashboard, mdiKeyboardOutline } from "@mdi/js";

export const getFieldConfig = (type, protocol) => {
    if (type === "server") {
        switch (protocol) {
            case "ssh":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
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
                    showMonitoring: false,
                    showKeyboardLayout: true,
                    showDisplaySettings: true,
                    showPerformanceSettings: true,
                    showAudioSettings: true,
                    showRdpSecurity: true,
                    showDisplayScale: true,
                    allowedAuthTypes: ["password-only", "password"],
                    showWakeOnLan: true,
                };
            case "vnc":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
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
                    showMonitoring: false,
                    showKeyboardLayout: false,
                };
            case "sftp":
                return {
                    showProtocol: false,
                    showIpPort: true,
                    showIdentities: true,
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
                    showMonitoring: true,
                    showKeyboardLayout: true,
                    allowedAuthTypes: ["password", "ssh", "both"],
                    showWakeOnLan: true,
                };
        }
    }

    if (type === "integration") {
        return {
            showProtocol: false,
            showIpPort: true,
            showIdentities: false,
            showCredentials: true,
            showMonitoring: true,
            showKeyboardLayout: false,
        };
    }

    if (type === "pve-shell" || type === "pve-lxc") {
        return {
            showProtocol: false,
            showIpPort: false,
            showIdentities: false,
            showMonitoring: false,
            showKeyboardLayout: false,
        };
    }

    if (type === "pve-qemu") {
        return {
            showProtocol: false,
            showIpPort: false,
            showIdentities: false,
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
        showMonitoring: true,
        showKeyboardLayout: false,
    };
};

export const getSections = (type, protocol) => {
    const config = getFieldConfig(type, protocol);
    const sections = [{ key: "general", label: "servers.dialog.sections.general", icon: mdiInformationOutline }];

    if (config.showIpPort) sections.push({ key: "connection", label: "servers.dialog.sections.connection", icon: mdiLanConnect });
    if (config.showIdentities) sections.push({ key: "identities", label: "servers.dialog.sections.identities", icon: mdiAccountKeyOutline });
    if (config.showCredentials) sections.push({ key: "credentials", label: "servers.dialog.sections.credentials", icon: mdiAccountKeyOutline });
    if (config.showTerminalSettings) sections.push({ key: "terminal", label: "servers.dialog.settings.terminal.title", icon: mdiKeyboardOutline });
    if (config.showKeyboardLayout || config.showDisplaySettings || config.showRdpSecurity || config.showAudioSettings || config.showPerformanceSettings)
        sections.push({ key: "display", label: "servers.dialog.settings.display.title", icon: mdiMonitorDashboard });
    if (config.showMonitoring || config.showWakeOnLan)
        sections.push({ key: "options", label: "servers.dialog.sections.options", icon: mdiTuneVariant });

    return sections;
};

export const validateRequiredFields = (type, protocol, name, config) => {
    const fieldConfig = getFieldConfig(type, protocol);

    if (!name) return false;

    if (fieldConfig.showIpPort && (!config.ip || !config.port)) return false;

    if (fieldConfig.showProtocol && !config.protocol) return false;

    if (fieldConfig.showCredentials && (!config.username || !config.password)) return false;

    return true;
};
