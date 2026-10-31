import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import DetailsPage from "@/pages/Servers/components/ServerDialog/pages/DetailsPage.jsx";
import Button from "@/common/components/Button";
import TabSwitcher from "@/common/components/TabSwitcher";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import IdentityPage from "@/pages/Servers/components/ServerDialog/pages/IdentityPage.jsx";
import SettingsPage from "@/pages/Servers/components/ServerDialog/pages/SettingsPage.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { getAvailableTabs, validateRequiredFields, getFieldConfig } from "./utils/fieldConfig.js";
import Icon from "@mdi/react";
import * as mdiIcons from "@mdi/js";

const PROTOCOL_DEFAULT_PORTS = { ssh: "22", telnet: "23", rdp: "3389", vnc: "5900", sftp: "22", ftp: "21", ftps: "21" };
const PROTOCOL_DEFAULT_ICONS = { ssh: "mdiConsole", telnet: "mdiConsole", rdp: "mdiMicrosoftWindows", vnc: "mdiMonitor", sftp: "mdiFolderNetwork", ftp: "mdiFolderNetwork", ftps: "mdiFolderNetwork", demo: "mdiFlaskOutline" };

export const ServerDialog = ({ open, onClose, currentFolderId, currentOrganizationId, editServerId, initialProtocol }) => {
    const { t } = useTranslation();

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const getProtocolIcon = (protocol, type) => {
        if (type?.startsWith('pve')) return "mdiServerNetwork";
        return { ssh: "mdiConsole", telnet: "mdiConsole", rdp: "mdiMonitor", vnc: "mdiDesktopClassic", sftp: "mdiFolderNetwork", ftp: "mdiFolderNetwork", ftps: "mdiFolderNetwork", demo: "mdiFlaskOutline" }[protocol] || "mdiServerNetwork";
    };

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [identities, setIdentities] = useState([]);
    const [config, setConfig] = useState({});
    const [inheritedConfig, setInheritedConfig] = useState({});
    const [inheritedIdentities, setInheritedIdentities] = useState([]);
    const [monitoringEnabled, setMonitoringEnabled] = useState(false);
    const [entryType, setEntryType] = useState("server");
    const [localOverrideKeys, setLocalOverrideKeys] = useState([]);

    const [identityUpdates, setIdentityUpdates] = useState({});

    const [activeTab, setActiveTab] = useState(0);
    
    const initialValues = useRef({ name: '', icon: null, config: {}, identities: '[]', monitoringEnabled: false, localOverrideKeys: '[]' });

    const fieldConfig = getFieldConfig(entryType, config.protocol);
    const tabs = getAvailableTabs(entryType, config.protocol);
    const explicitOverrideKeys = useMemo(() => new Set(localOverrideKeys), [localOverrideKeys]);
    const overrides = useMemo(() => Object.keys(config).filter((key) =>
        key !== "protocol"
        && Object.hasOwn(inheritedConfig, key)
        && (explicitOverrideKeys.has(key)
            || JSON.stringify(config[key]) !== JSON.stringify(inheritedConfig[key]))
    ), [config, inheritedConfig, explicitOverrideKeys]);

    const normalizeIdentity = (identity) => {
        const normalized = { ...identity };
        if (normalized.username === "") normalized.username = undefined;

        if (!identity.passwordTouched && normalized.password === "") normalized.password = undefined;
        if (!identity.passphraseTouched && normalized.passphrase === "") normalized.passphrase = undefined;
        
        if (normalized.sshKey === null) normalized.sshKey = undefined;
        return normalized;
    };

    const buildIdentityPayload = (identity) => {
        const payload = {
            name: identity.name,
            username: identity.authType === 'password-only' ? undefined : identity.username,
            type: identity.authType,
        };

        if (identity.organizationId) {
            payload.organizationId = identity.organizationId;
        }
        
        const hasPassphrase = typeof identity.passphrase === "string" && identity.passphrase.length > 0;

        if (identity.authType === 'password' || identity.authType === 'password-only') {
            if (identity.passwordTouched || identity.password) {
                payload.password = identity.password;
            }
        } else if (identity.authType === 'both') {
            if (identity.passwordTouched || identity.password) {
                payload.password = identity.password;
            }
            payload.sshKey = identity.sshKey;
            if (hasPassphrase) {
                payload.passphrase = identity.passphrase;
            }
        } else {
            payload.sshKey = identity.sshKey;
            if (hasPassphrase) {
                payload.passphrase = identity.passphrase;
            }
        }
        
        return payload;
    };

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
                    sendToast("Error", t(error.message) || t("servers.messages.createIdentityFailed"));
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
                    sendToast("Error", t(error.message) || t("servers.messages.updateIdentityFailed"));
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
        }

        if (entryType !== "server") {
            delete finalConfig.protocol;
        }

        if (!fieldConfig.showKeyboardLayout) {
            delete finalConfig.keyboardLayout;
        }
        
        return finalConfig;
    };

    const resetOverride = useCallback((key) => {
        const value = inheritedConfig[key];
        setLocalOverrideKeys((current) => current.filter((overrideKey) => overrideKey !== key));
        setConfig((current) => {
            const next = { ...current };
            if (Object.hasOwn(inheritedConfig, key)) next[key] = value;
            else delete next[key];
            return next;
        });
        if (key === "monitoringEnabled") setMonitoringEnabled(Boolean(value ?? true));
    }, [inheritedConfig]);

    const buildLocalConfig = () => Object.fromEntries(
        Object.entries(buildConfig()).filter(([key, value]) => key === "protocol"
            || explicitOverrideKeys.has(key)
            || JSON.stringify(value) !== JSON.stringify(inheritedConfig[key]))
    );

    const serverIdentities = useMemo(() => [...identities, ...inheritedIdentities.filter((identityId) => !identities.includes(identityId))], [identities, inheritedIdentities]);

    const createServer = async () => {
        try {
            const serverIdentityIds = await updateIdentities();
            if (serverIdentityIds === null) return;

            loadIdentities();

            const result = await putRequest("entries", {
                name,
                icon,
                config: buildLocalConfig(),
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
                config: buildLocalConfig(),
                identities: serverIdentityIds,
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
        let cancelled = false;

        if (editServerId) {
            getRequest("entries/" + editServerId).then((server) => {
                if (cancelled) return;
                setName(server.name);
                const savedOverrideKeys = Object.keys(server.localConfig || {}).filter((key) => key !== "protocol");
                setLocalOverrideKeys(savedOverrideKeys);
                setIcon(server.icon || null);
                setIdentities(server.localIdentities || []);
                setEntryType(server.type || "server");

                const parsedConfig = server.config || {};
                setConfig(parsedConfig);
                setInheritedConfig(server.inheritedConfig || {});
                setInheritedIdentities(server.inheritedIdentities || []);
                setMonitoringEnabled(Boolean(parsedConfig.monitoringEnabled ?? true));
                initialValues.current = {
                    name: server.name,
                    icon: server.icon || null,
                    config: JSON.stringify(parsedConfig),
                    identities: JSON.stringify(server.localIdentities || []),
                    monitoringEnabled: Boolean(parsedConfig.monitoringEnabled ?? true),
                    localOverrideKeys: JSON.stringify(savedOverrideKeys),
                };
            });
        } else {
            setLocalOverrideKeys([]);
            setName("");
            setIcon(null);
            setIdentities([]);
            setEntryType("server");
            setInheritedConfig({});
            setInheritedIdentities([]);
            
            if (initialProtocol) {
                let initialConfig = { protocol: initialProtocol };
                if (getFieldConfig("server", initialProtocol).showIpPort) {
                    initialConfig.port = PROTOCOL_DEFAULT_PORTS[initialProtocol] || "";
                }

                setConfig(initialConfig);
                const defaultIcon = PROTOCOL_DEFAULT_ICONS[initialProtocol] || null;
                setIcon(defaultIcon);
                initialValues.current = { 
                    name: '', 
                    icon: defaultIcon, 
                    config: JSON.stringify(initialConfig), 
                    identities: '[]',
                    monitoringEnabled: false,
                    localOverrideKeys: '[]',
                };
            } else {
                setConfig({});
                initialValues.current = { name: '', icon: null, config: '{}', identities: '[]', monitoringEnabled: false, localOverrideKeys: '[]' };
            }
            setMonitoringEnabled(false);

            if (currentFolderId) {
                getRequest("folders/" + currentFolderId + "?protocol=" + (initialProtocol || "")).then((folder) => {
                    if (cancelled) return;
                    const inherited = folder.config || {};
                    setConfig((current) => {
                        const base = { ...current };
                        // An untouched protocol default must not override the folder's inherited port
                        if (inherited.port !== undefined && String(base.port) === PROTOCOL_DEFAULT_PORTS[base.protocol]) delete base.port;
                        const next = { ...inherited, ...base };
                        initialValues.current = {
                            ...initialValues.current,
                            config: JSON.stringify(next),
                            identities: '[]',
                        };
                        return next;
                    });
                    setIdentities([]);
                    setInheritedConfig(inherited);
                    setInheritedIdentities(folder.identities || []);
                });
            }
        }

        setIdentityUpdates({});
        setActiveTab(0);
        return () => { cancelled = true; };
    }, [open, editServerId, initialProtocol, currentFolderId, fieldConfig.showIpPort]);

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
        getRequest("entries/" + editServerId).then((server) => setIdentities(server.localIdentities || []));
    };

    const isDirty = name !== initialValues.current.name || 
                     icon !== initialValues.current.icon ||
                     JSON.stringify(config) !== initialValues.current.config ||
                     JSON.stringify(identities) !== initialValues.current.identities ||
                     monitoringEnabled !== initialValues.current.monitoringEnabled ||
                     JSON.stringify(localOverrideKeys) !== initialValues.current.localOverrideKeys ||
                     Object.keys(identityUpdates).length > 0;

    const tabSwitcherTabs = useMemo(() => tabs.map((tab, index) => ({
        key: index.toString(),
        label: t(tab.label),
        icon: tab.icon
    })), [tabs, t]);

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
            <div className="server-dialog">
                <div className="server-dialog-header">
                    <div className="dialog-icon">
                        <Icon path={mdiIcons[getProtocolIcon(config.protocol, entryType)] || mdiIcons.mdiServerNetwork} size={1} />
                    </div>
                    <div className="server-dialog-title">
                        <h2>
                            {editServerId 
                                ? t("servers.dialog.editServer") 
                                : config.protocol 
                                    ? t("servers.dialog.addProtocolServer", { protocol: config.protocol.toUpperCase() })
                                    : t("servers.dialog.addServer")
                            }
                        </h2>
                        {entryType === "server" && config.protocol && (
                            <span className="protocol-badge">{config.protocol.toUpperCase()}</span>
                        )}
                        {entryType?.startsWith('pve') && (
                            <span className="protocol-badge">
                                {entryType === 'pve-shell' ? 'PVE SHELL' : 
                                 entryType === 'pve-lxc' ? 'PVE LXC' : 
                                 entryType === 'pve-qemu' ? 'PVE QEMU' : 'PVE'}
                            </span>
                        )}
                    </div>
                </div>

                {tabs.length > 1 && (
                    <div className="server-dialog-tabs">
                        <TabSwitcher
                            tabs={tabSwitcherTabs}
                            activeTab={activeTab.toString()}
                            onTabChange={(tabKey) => setActiveTab(parseInt(tabKey))}
                            variant="dialog"
                        />
                    </div>
                )}

                <form className="server-dialog-content" onSubmit={(e) => e.preventDefault()} autoComplete="on">
                    {activeTab === 0 && <DetailsPage name={name} setName={setName}
                                                     icon={icon} setIcon={setIcon}
                                                     config={config} setConfig={setConfig}
                                                     fieldConfig={fieldConfig} overrides={overrides} onReset={resetOverride} inheritedConfig={inheritedConfig} />}
                    {activeTab === 1 && tabs[1]?.key === "identities" &&
                        <IdentityPage setIdentityUpdates={setIdentityUpdates}
                                      identityUpdates={identityUpdates} setIdentities={setIdentities}
                                      currentOrganizationId={currentOrganizationId} allowedAuthTypes={fieldConfig.allowedAuthTypes}
                                      serverName={name} specificIdentities={identities} serverIdentities={serverIdentities} />}
                    {tabs.find((tab, idx) => idx === activeTab && tab.key === "settings") && 
                        <SettingsPage config={config} setConfig={setConfig}
                                      monitoringEnabled={monitoringEnabled} setMonitoringEnabled={setMonitoringEnabled}
                                      fieldConfig={fieldConfig} editServerId={editServerId} overrides={overrides} onReset={resetOverride} inheritedConfig={inheritedConfig} />}
                </form>

                <Button className="server-dialog-button" onClick={handleSubmit}
                        text={editServerId ? t("servers.dialog.actions.save") : t("servers.dialog.actions.create")} />
            </div>

        </DialogProvider>
    );
};
