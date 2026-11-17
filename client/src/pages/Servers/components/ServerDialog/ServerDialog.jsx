import { useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getRequest, patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { getSections, validateRequiredFields, getFieldConfig } from "./utils/fieldConfig.js";
import { withConfigDefaults } from "./utils/configDefaults.js";
import { useUnsavedChanges } from "@/common/hooks/useUnsavedChanges.js";
import * as mdiIcons from "@mdi/js";
import GeneralSection from "./sections/GeneralSection.jsx";
import ConnectionSection from "./sections/ConnectionSection.jsx";
import IdentitiesSection, { buildServerIdentities } from "./sections/IdentitiesSection.jsx";
import TerminalSection from "./sections/TerminalSection.jsx";
import DisplaySection from "./sections/DisplaySection.jsx";
import OptionsSection from "./sections/OptionsSection.jsx";
import CredentialsSection from "./sections/CredentialsSection.jsx";
import SectionedDialog from "@/common/components/SectionedDialog";
import "./styles.sass";

const PROTOCOL_DEFAULT_PORTS = { ssh: "22", telnet: "23", rdp: "3389", vnc: "5900", spice: "5930", sftp: "22", ftp: "21", ftps: "21" };
const PROTOCOL_DEFAULT_ICONS = { ssh: "mdiConsole", telnet: "mdiConsole", rdp: "mdiMicrosoftWindows", vnc: "mdiMonitor", spice: "mdiMonitor", sftp: "mdiFolderNetwork", ftp: "mdiFolderNetwork", ftps: "mdiFolderNetwork", demo: "mdiFlaskOutline" };
const PROTOCOL_HEADER_ICONS = { ssh: "mdiConsole", telnet: "mdiConsole", rdp: "mdiMonitor", vnc: "mdiDesktopClassic", spice: "mdiMonitor", sftp: "mdiFolderNetwork", ftp: "mdiFolderNetwork", ftps: "mdiFolderNetwork", demo: "mdiFlaskOutline" };
const INTEGRATION_PROTOCOL = "pve";
const PASSWORD_MASK = "********";

export const ServerDialog = ({ open, onClose, currentFolderId, currentOrganizationId, editServerId, initialProtocol }) => {
    const { t } = useTranslation();

    const { loadServers } = useContext(ServerContext);
    const { loadIdentities, identities: knownIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [name, setName] = useState("");
    const [icon, setIcon] = useState(null);
    const [identities, setIdentities] = useState([]);
    const [config, setConfig] = useState({});
    const [inheritedConfig, setInheritedConfig] = useState({});
    const [inheritedIdentities, setInheritedIdentities] = useState([]);
    const [monitoringEnabled, setMonitoringEnabled] = useState(false);
    const [entryType, setEntryType] = useState("server");
    const [localOverrideKeys, setLocalOverrideKeys] = useState([]);
    const isIntegration = initialProtocol === INTEGRATION_PROTOCOL;
    const [identityUpdates, setIdentityUpdates] = useState({});

    const dialogRef = useRef(null);

    const effectiveIdentities = useCallback((ids, updates) => [...(ids || [])].map(String).sort().map((id) => {
        const source = knownIdentities?.find(i => String(i.id) === id);
        const update = updates?.[id];
        return {
            id,
            name: update?.name ?? source?.name,
            username: update?.username ?? source?.username,
            authType: update?.authType ?? source?.authType ?? source?.type,
            scope: update?.scope ?? source?.scope,
            organizationId: update?.organizationId ?? source?.organizationId,
            global: update?.global ?? (source ? !source.entryId : undefined),
            password: update?.passwordTouched ? update.password : undefined,
            sshKey: update?.sshKey ?? undefined,
            passphrase: update?.passphraseTouched ? update.passphrase : undefined,
        };
    }), [knownIdentities]);

    const normalizeDraft = useCallback((draft) => ({
        name: draft.name,
        icon: draft.icon,
        config: withConfigDefaults(draft.config),
        monitoringEnabled: draft.monitoringEnabled,
        identities: effectiveIdentities(draft.identities, draft.identityUpdates),
        localOverrideKeys: draft.localOverrideKeys || [],
    }), [effectiveIdentities]);

    const draft = useMemo(() => ({ name, icon, config, monitoringEnabled, identities, identityUpdates, localOverrideKeys }),
        [name, icon, config, monitoringEnabled, identities, identityUpdates, localOverrideKeys]);
    const { isDirty, markClean, reset: resetDirty } = useUnsavedChanges(draft, { normalize: normalizeDraft });

    const fieldConfig = getFieldConfig(entryType, config.protocol);
    const sections = useMemo(() => getSections(entryType, config.protocol), [entryType, config.protocol]);
    const sectionKeys = useMemo(() => sections.map(s => s.key), [sections]);
    const explicitOverrideKeys = useMemo(() => new Set(localOverrideKeys), [localOverrideKeys]);
    const overrides = useMemo(() => Object.keys(config).filter((key) =>
        key !== "protocol"
        && Object.hasOwn(inheritedConfig, key)
        && (explicitOverrideKeys.has(key)
            || JSON.stringify(config[key]) !== JSON.stringify(inheritedConfig[key]))
    ), [config, inheritedConfig, explicitOverrideKeys]);

    const identityPayload = () => buildServerIdentities(
        [...identities, ...inheritedIdentities.filter((id) => identityUpdates[id] && !identities.includes(id))],
        identityUpdates, knownIdentities, name
    );

    const buildConfig = () => {
        const finalConfig = { ...config };
        if (fieldConfig.showMonitoring) finalConfig.monitoringEnabled = monitoringEnabled;
        else delete finalConfig.monitoringEnabled;
        if (!fieldConfig.showIpPort) { delete finalConfig.ip; delete finalConfig.port; }
        if (entryType !== "server") delete finalConfig.protocol;
        if (!fieldConfig.showKeyboardLayout) delete finalConfig.keyboardLayout;
        if (!fieldConfig.showConnectionHooks) {
            delete finalConfig.preLocalCommand;
            delete finalConfig.preRemoteCommand;
            delete finalConfig.preOrder;
            delete finalConfig.afterLocalCommand;
            delete finalConfig.afterRemoteCommand;
            delete finalConfig.afterOrder;
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
    const inheritance = useMemo(() => ({ inheritedConfig, overrides, onReset: resetOverride }), [inheritedConfig, overrides, resetOverride]);

    const createServer = async () => {
        try {
            const result = await putRequest("entries", {
                name, icon, config: buildLocalConfig(), folderId: currentFolderId, organizationId: currentOrganizationId,
                identities: identityPayload(), type: "server",
            });

            loadIdentities();
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
            await patchRequest("entries/" + editServerId, { name, icon, config: buildLocalConfig(), identities: identityPayload() });

            loadIdentities();
            loadServers();
            sendToast("Success", t("servers.messages.serverUpdated"));
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t("servers.messages.updateFailed"));
            console.error(error);
        }
    };

    const saveIntegration = async () => {
        const payload = {
            name, ip: config.ip, port: config.port, username: config.username, monitoringEnabled,
            password: editServerId && config.password === PASSWORD_MASK ? undefined : config.password,
        };
        try {
            const response = editServerId
                ? await patchRequest(`integrations/${editServerId}`, payload)
                : await putRequest("integrations", { ...payload, folderId: currentFolderId, organizationId: currentOrganizationId });
            if (response?.code) {
                sendToast("Error", response.message);
                return;
            }
            sendToast("Success", t(editServerId ? "servers.proxmoxDialog.messages.updated" : "servers.proxmoxDialog.messages.created"));
            loadServers();
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t(editServerId ? "servers.proxmoxDialog.messages.updateFailed" : "servers.proxmoxDialog.messages.createFailed"));
            console.error(error);
        }
    };

    const handleSubmit = useCallback(() => {
        if (!validateRequiredFields(entryType, config.protocol, name, config)) {
            sendToast("Error", t("servers.messages.fillRequiredFields"));
            const missingCredentials = fieldConfig.showCredentials && name && config.ip && config.port;
            dialogRef.current?.scrollTo(missingCredentials ? "credentials" : fieldConfig.showIpPort && name ? "connection" : "general");
            return;
        }
        if (isIntegration) return saveIntegration();
        editServerId ? patchServer() : createServer();
    }, [name, icon, editServerId, identities, identityUpdates, currentFolderId, config, inheritedConfig, localOverrideKeys, monitoringEnabled, entryType, isIntegration, t]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        resetDirty();

        if (isIntegration) {
            setIcon(null);
            setIdentities([]);
            setLocalOverrideKeys([]);
            setInheritedConfig({});
            setInheritedIdentities([]);
            setEntryType("integration");
            if (editServerId) {
                getRequest(`integrations/${editServerId}`).then((integration) => {
                    const loaded = { ip: integration.ip, port: String(integration.port ?? ""), username: integration.username, password: PASSWORD_MASK };
                    setName(integration.name);
                    setConfig(loaded);
                    setMonitoringEnabled(Boolean(integration.monitoringEnabled));
                    markClean({ name: integration.name, icon: null, config: loaded, monitoringEnabled: Boolean(integration.monitoringEnabled), identities: [], identityUpdates: {} });
                }).catch(err => console.error(err));
            } else {
                const initialConfig = { port: "8006" };
                setName("");
                setConfig(initialConfig);
                setMonitoringEnabled(false);
                markClean({ name: "", icon: null, config: initialConfig, monitoringEnabled: false, identities: [], identityUpdates: {} });
            }
        } else if (editServerId) {
            getRequest("entries/" + editServerId).then((server) => {
                if (cancelled) return;
                setName(server.name);
                const savedOverrideKeys = Object.keys(server.localConfig).filter((key) => key !== "protocol");
                setLocalOverrideKeys(savedOverrideKeys);
                setIcon(server.icon || null);
                setIdentities(server.localIdentities);
                setEntryType(server.type || "server");

                const parsedConfig = server.config || {};
                setConfig(parsedConfig);
                setInheritedConfig(server.inheritedConfig);
                setInheritedIdentities(server.inheritedIdentities);
                setMonitoringEnabled(Boolean(parsedConfig.monitoringEnabled ?? true));
                markClean({
                    name: server.name, icon: server.icon || null, config: parsedConfig,
                    monitoringEnabled: Boolean(parsedConfig.monitoringEnabled ?? true),
                    identities: server.localIdentities, identityUpdates: {}, localOverrideKeys: savedOverrideKeys,
                });
            });
        } else {
            setLocalOverrideKeys([]);
            setName("");
            setIcon(null);
            setIdentities([]);
            setEntryType("server");
            setInheritedConfig({});
            setInheritedIdentities([]);

            const initialConfig = {};
            let defaultIcon = null;
            if (initialProtocol) {
                initialConfig.protocol = initialProtocol;
                if (getFieldConfig("server", initialProtocol).showIpPort) initialConfig.port = PROTOCOL_DEFAULT_PORTS[initialProtocol] || "";
                defaultIcon = PROTOCOL_DEFAULT_ICONS[initialProtocol] || null;
                setIcon(defaultIcon);
            }
            setConfig(initialConfig);
            setMonitoringEnabled(false);
            const cleanDraft = { name: "", icon: defaultIcon, config: initialConfig, monitoringEnabled: false, identities: [], identityUpdates: {}, localOverrideKeys: [] };

            if (currentFolderId) {
                const withInherited = (inherited, current) => {
                    const base = { ...current };
                    if (inherited.port !== undefined && String(base.port) === PROTOCOL_DEFAULT_PORTS[base.protocol]) delete base.port;
                    return { ...inherited, ...base };
                };
                getRequest("folders/" + currentFolderId + "?protocol=" + (initialProtocol || "")).then((folder) => {
                    if (cancelled) return;
                    const inherited = folder.config;
                    setConfig((current) => withInherited(inherited, current));
                    setIdentities([]);
                    setInheritedConfig(inherited);
                    setInheritedIdentities(folder.identities);
                    markClean({ ...cleanDraft, config: withInherited(inherited, initialConfig) });
                }).catch(() => {
                    if (!cancelled) markClean(cleanDraft);
                });
            } else {
                markClean(cleanDraft);
            }
        }

        setIdentityUpdates({});
        dialogRef.current?.scrollToTop();
        return () => { cancelled = true; };
    }, [open, editServerId, initialProtocol, isIntegration, currentFolderId]);

    useEffect(() => {
        if (!open) return;

        const submitOnEnter = (event) => {
            if (event.key !== "Enter") return;
            if (event.target?.tagName === "TEXTAREA" || event.target?.tagName === "BUTTON") return;
            if (event.target?.closest?.(".icon-chooser__dropdown, .select-box")) return;
            handleSubmit();
        };

        document.addEventListener("keydown", submitOnEnter);
        return () => document.removeEventListener("keydown", submitOnEnter);
    }, [open, handleSubmit]);

    const headerIcon = isIntegration || entryType?.startsWith("pve") ? "mdiServerNetwork" : (PROTOCOL_HEADER_ICONS[config.protocol] || "mdiServerNetwork");
    const title = isIntegration
        ? (editServerId ? (name || t("servers.proxmoxDialog.title.edit")) : t("servers.proxmoxDialog.title.import"))
        : editServerId
            ? (name || t("servers.dialog.editServer"))
            : config.protocol ? t("servers.dialog.addProtocolServer", { protocol: config.protocol.toUpperCase() }) : t("servers.dialog.addServer");
    const subtitle = editServerId ? (isIntegration ? t("servers.proxmoxDialog.title.edit") : t("servers.dialog.editServer")) : null;

    const has = (key) => sectionKeys.includes(key);

    return (
        <SectionedDialog ref={dialogRef} open={open} onClose={onClose} isDirty={isDirty} inheritance={inheritance}
                         icon={mdiIcons[headerIcon] || mdiIcons.mdiServerNetwork} title={title} subtitle={subtitle} sections={sections}
                         onSubmit={handleSubmit}
                         submitLabel={isIntegration
                             ? t(editServerId ? "servers.proxmoxDialog.actions.edit" : "servers.proxmoxDialog.actions.import")
                             : t(editServerId ? "servers.dialog.actions.save" : "servers.dialog.actions.create")}>
            <GeneralSection name={name} setName={setName} icon={icon} setIcon={setIcon} config={config} setConfig={setConfig}
                            showIcon={!isIntegration} showEngine={!isIntegration}
                            namePlaceholder={isIntegration ? t("servers.proxmoxDialog.placeholders.name") : undefined} />
            {has("connection") && <ConnectionSection config={config} setConfig={setConfig} fieldConfig={fieldConfig} editServerId={editServerId} />}
            {has("credentials") && <CredentialsSection config={config} setConfig={setConfig} description={t("servers.proxmoxDialog.credentialsDescription")} />}
            {has("identities") && (
                <IdentitiesSection serverIdentities={serverIdentities} specificIdentities={identities} setIdentityUpdates={setIdentityUpdates}
                                   identityUpdates={identityUpdates} setIdentities={setIdentities}
                                   currentOrganizationId={currentOrganizationId} allowedAuthTypes={fieldConfig.allowedAuthTypes}
                                   serverName={name} bindable />
            )}
            {has("terminal") && <TerminalSection config={config} setConfig={setConfig} />}
            {has("display") && <DisplaySection config={config} setConfig={setConfig} fieldConfig={fieldConfig} />}
            {has("options") && (
                <OptionsSection config={config} setConfig={setConfig} fieldConfig={fieldConfig}
                                monitoringEnabled={monitoringEnabled} setMonitoringEnabled={setMonitoringEnabled}
                                monitoringLabel={isIntegration ? t("servers.proxmoxDialog.fields.monitoring") : undefined}
                                monitoringDescription={isIntegration ? t("servers.proxmoxDialog.monitoringDescription") : undefined} />
            )}
        </SectionedDialog>
    );
};
