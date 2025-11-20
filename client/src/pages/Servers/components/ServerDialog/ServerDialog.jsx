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

const tabs = [
    { key: "details", label: "servers.dialog.tabs.details" },
    { key: "identities", label: "servers.dialog.tabs.identities" },
    { key: "settings", label: "servers.dialog.tabs.settings" }
];

export const ServerDialog = ({ open, onClose, currentFolderId, currentOrganizationId, editServerId }) => {
    const { t } = useTranslation();

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [identities, setIdentities] = useState([]);
    const [config, setConfig] = useState({});
    const [monitoringEnabled, setMonitoringEnabled] = useState(false);

    const [identityUpdates, setIdentityUpdates] = useState({});

    const [activeTab, setActiveTab] = useState(0);

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

    const createServer = async () => {
        try {
            const serverIdentityIds = await updateIdentities();
            if (serverIdentityIds === null) return;

            loadIdentities();

            const result = await putRequest("entries", {
                name, icon: icon,
                config: { ...config, monitoringEnabled },
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
                config: { ...config, monitoringEnabled },
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
        if (!name || !config.ip || !config.port || !config.protocol) {
            sendToast("Error", t("servers.messages.fillRequiredFields"));
            return;
        }
        editServerId ? patchServer() : createServer();
    }, [name, icon, editServerId, identityUpdates, currentFolderId, config, monitoringEnabled, t]);

    useEffect(() => {
        if (!open) return;

        if (editServerId) {
            getRequest("entries/" + editServerId).then((server) => {
                setName(server.name);
                setIcon(server.icon || "server");
                setIdentities(server.identities);

                try {
                    if (server.config) {
                        const parsedConfig = typeof server.config === 'string' ? JSON.parse(server.config) : server.config;
                        setConfig(parsedConfig);
                        setMonitoringEnabled(Boolean(parsedConfig.monitoringEnabled ?? true));
                    } else {
                        setConfig({});
                        setMonitoringEnabled(false);
                    }
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
            setConfig({});
            setMonitoringEnabled(false);
        }

        setIdentityUpdates({});
        setActiveTab(0);
    }, [open, editServerId]);

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

        getRequest("servers/" + editServerId).then((server) => {
            setIdentities(server.identities);
        });
    };

    useEffect(() => {
        if (!open) return;

        // Default port for each protocol
        if (config.protocol === "ssh" && (!config.port || config.port === "3389" || config.port === "5900")) {
            setConfig(prev => ({ ...prev, port: "22" }));
        }
        if (config.protocol === "rdp" && (!config.port || config.port === "22" || config.port === "5900")) {
            setConfig(prev => ({ ...prev, port: "3389" }));
        }
        if (config.protocol === "vnc" && (!config.port || config.port === "22" || config.port === "3389")) {
            setConfig(prev => ({ ...prev, port: "5900" }));
        }
    }, [config.protocol, open]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="server-dialog">
                <div className="server-dialog-title">
                    <h2>{editServerId ? t("servers.dialog.editServer") : t("servers.dialog.addServer")}</h2>
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
                                                     config={config} setConfig={setConfig} />}
                    {activeTab === 1 &&
                        <IdentityPage serverIdentities={identities} setIdentityUpdates={setIdentityUpdates}
                                      identityUpdates={identityUpdates} setIdentities={setIdentities} />}
                    {activeTab === 2 && <SettingsPage protocol={config.protocol} config={config} setConfig={setConfig}
                                                       monitoringEnabled={monitoringEnabled} setMonitoringEnabled={setMonitoringEnabled} />}
                </div>

                <Button className="server-dialog-button" onClick={handleSubmit}
                        text={editServerId ? t("servers.dialog.actions.save") : t("servers.dialog.actions.create")} />
            </div>

        </DialogProvider>
    );
};