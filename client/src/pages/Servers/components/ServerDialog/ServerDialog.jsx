import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState, useCallback } from "react";
import DetailsPage from "@/pages/Servers/components/ServerDialog/pages/DetailsPage.jsx";
import Button from "@/common/components/Button";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import IdentityPage from "@/pages/Servers/components/ServerDialog/pages/IdentityPage.jsx";
import SettingsPage from "@/pages/Servers/components/ServerDialog/pages/SettingsPage.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { getAvailableTabs, validateRequiredFields, getFieldConfig } from "./utils/fieldConfig.js";

export const ServerDialog = ({ open, onClose, currentFolderId, currentOrganizationId, editServerId, initialProtocol }) => {
    const { t } = useTranslation();

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [identities, setIdentities] = useState([]);
    const [config, setConfig] = useState({});
    const [monitoringEnabled, setMonitoringEnabled] = useState(false);
    const [entryType, setEntryType] = useState("server");

    const [identityUpdates, setIdentityUpdates] = useState({});

    const [activeTab, setActiveTab] = useState(0);

    const fieldConfig = getFieldConfig(entryType, config.protocol);
    const tabs = getAvailableTabs(entryType, config.protocol);

    const normalizeIdentity = (identity) => {
        const normalized = { ...identity };
        if (normalized.username === "") normalized.username = undefined;
        if (normalized.passphrase === "") normalized.passphrase = undefined;
        if (normalized.password === "") normalized.password = undefined;
        if (normalized.sshKey === null) normalized.sshKey = undefined;
        return normalized;
    };

    const buildIdentityPayload = (identity) => ({
        name: identity.name,
        username: identity.username,
        type: identity.authType,
        password: identity.password,
        sshKey: identity.sshKey,
        passphrase: identity.passphrase,
    });

    const updateIdentities = async () => {
        const allIdentityIds = new Set();

        identities.forEach(id => allIdentityIds.add(id));

        for (const identityId of Object.keys(identityUpdates)) {
            const identity = normalizeIdentity(identityUpdates[identityId]);

            if (identityId.startsWith("new-")) {
                const payload = buildIdentityPayload(identity);
                try {
                    const result = await putRequest("identities", payload);
                    if (result.id) allIdentityIds.add(result.id);
                } catch (error) {
                    sendToast("Error", error.message || t("servers.messages.createIdentityFailed"));
                    console.error(error);
                    return null;
                }
            } else if (identity.linked) {
                allIdentityIds.add(parseInt(identityId));
            } else {
                const payload = buildIdentityPayload(identity);
                try {
                    await patchRequest("identities/" + identityId, payload);
                    allIdentityIds.add(parseInt(identityId));
                } catch (error) {
                    sendToast("Error", error.message || t("servers.messages.updateIdentityFailed"));
                    console.error(error);
                    return null;
                }
            }
        }

        return Array.from(allIdentityIds);
    };

    const buildConfig = () => {
        const finalConfig = { ...config };
        
        if (fieldConfig.showMonitoring) {
            finalConfig.monitoringEnabled = monitoringEnabled;
        } else {
            delete finalConfig.monitoringEnabled;
        }
        
        if (!fieldConfig.showIpPort) {
            delete finalConfig.ip;
            delete finalConfig.port;
            delete finalConfig.protocol;
        }
        
        if (!fieldConfig.showKeyboardLayout) {
            delete finalConfig.keyboardLayout;
        }
        
        return finalConfig;
    };

    const createServer = async () => {
        try {
            const serverIdentityIds = await updateIdentities();
            if (serverIdentityIds === null) return;

            loadIdentities();

            const result = await putRequest("entries", {
                name,
                icon,
                config: buildConfig(),
                folderId: currentFolderId,
                organizationId: currentOrganizationId,
                identities: serverIdentityIds,
                type: "server"
            });

            loadServers();
            if (result.id) {
                sendToast("Success", t("servers.messages.serverCreated"));
                onClose();
            }
        } catch (error) {
            sendToast("Error", error.message || t("servers.messages.createFailed"));
            console.error(error);
        }
    };

    const patchServer = async () => {
        try {
            const serverIdentityIds = await updateIdentities();
            if (serverIdentityIds === null) return;

            await patchRequest("entries/" + editServerId, {
                name, icon,
                config: buildConfig(),
                identities: serverIdentityIds
            });

            loadServers();
            sendToast("Success", t("servers.messages.serverUpdated"));
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t("servers.messages.updateFailed"));
            console.error(error);
        }
    };

    const handleSubmit = useCallback(() => {
        if (!validateRequiredFields(entryType, config.protocol, name, config)) {
            sendToast("Error", t("servers.messages.fillRequiredFields"));
            return;
        }
        editServerId ? patchServer() : createServer();
    }, [name, icon, editServerId, identityUpdates, currentFolderId, config, monitoringEnabled, entryType, t]);

    useEffect(() => {
        if (!open) return;

        if (editServerId) {
            getRequest("entries/" + editServerId).then((server) => {
                setName(server.name);
                setIcon(server.icon || "server");
                setIdentities(server.identities);
                setEntryType(server.type || "server");

                try {
                    const parsedConfig = typeof server.config === 'string' ? JSON.parse(server.config) : server.config || {};
                    setConfig(parsedConfig);
                    setMonitoringEnabled(Boolean(parsedConfig.monitoringEnabled ?? true));
                } catch (error) {
                    console.error("Failed to parse server config:", error);
                    setConfig({});
                    setMonitoringEnabled(false);
                }
            });
        } else {
            setName("");
            setIcon(null);
            setIdentities([]);
            setEntryType("server");
            
            if (initialProtocol) {
                setConfig({ protocol: initialProtocol });
                const iconMap = { ssh: "terminal", telnet: "terminal", rdp: "windows", vnc: "desktop" };
                setIcon(iconMap[initialProtocol] || null);
            } else {
                setConfig({});
            }
            setMonitoringEnabled(false);
        }

        setIdentityUpdates({});
        setActiveTab(0);
    }, [open, editServerId, initialProtocol]);

    useEffect(() => {
        if (!open) return;

        const submitOnEnter = (event) => {
            if (event.key === "Enter") {
                handleSubmit();
            }
        };

        document.addEventListener("keydown", submitOnEnter);

        return () => {
            document.removeEventListener("keydown", submitOnEnter);
        };
    }, [open, handleSubmit]);

    const refreshIdentities = () => {
        if (!editServerId) return;
        getRequest("servers/" + editServerId).then((server) => setIdentities(server.identities));
    };

    useEffect(() => {
        if (!open || !fieldConfig.showIpPort) return;

        const portMap = { ssh: "22", telnet: "23", rdp: "3389", vnc: "5900" };
        const currentPort = config.port;
        const expectedPort = portMap[config.protocol];

        if (expectedPort && (!currentPort || Object.values(portMap).includes(currentPort))) {
            setConfig(prev => ({ ...prev, port: expectedPort }));
        }
    }, [config.protocol, open, fieldConfig.showIpPort]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="server-dialog">
                <div className="server-dialog-title">
                    <h2>
                        {editServerId 
                            ? t("servers.dialog.editServer") 
                            : config.protocol 
                                ? t("servers.dialog.addProtocolServer", { protocol: config.protocol.toUpperCase() })
                                : t("servers.dialog.addServer")
                        }
                    </h2>
                </div>

                <div className="server-dialog-tabs">
                    {tabs.map((tab, index) => (
                        <div key={index} className={`tabs-item ${activeTab === index ? "tabs-item-active" : ""}`}
                             onClick={() => setActiveTab(index)}>
                            <h3>{t(tab.label)}</h3>
                        </div>
                    ))}
                </div>

                <div className="server-dialog-content">
                    {activeTab === 0 && <DetailsPage name={name} setName={setName}
                                                     icon={icon} setIcon={setIcon}
                                                     config={config} setConfig={setConfig}
                                                     fieldConfig={fieldConfig} />}
                    {activeTab === 1 && tabs[1]?.key === "identities" &&
                        <IdentityPage serverIdentities={identities} setIdentityUpdates={setIdentityUpdates}
                                      identityUpdates={identityUpdates} setIdentities={setIdentities} />}
                    {tabs.find((tab, idx) => idx === activeTab && tab.key === "settings") && 
                        <SettingsPage config={config} setConfig={setConfig}
                                      monitoringEnabled={monitoringEnabled} setMonitoringEnabled={setMonitoringEnabled}
                                      fieldConfig={fieldConfig} />}
                </div>

                <Button className="server-dialog-button" onClick={handleSubmit}
                        text={editServerId ? t("servers.dialog.actions.save") : t("servers.dialog.actions.create")} />
            </div>

        </DialogProvider>
    );
};