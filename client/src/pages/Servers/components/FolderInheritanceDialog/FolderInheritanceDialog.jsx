import { DialogProvider } from "@/common/components/Dialog";
import Button from "@/common/components/Button";
import Input from "@/common/components/IconInput";
import TabSwitcher from "@/common/components/TabSwitcher";
import ToggleSwitch from "@/common/components/ToggleSwitch";
import DetailsPage from "@/pages/Servers/components/ServerDialog/pages/DetailsPage.jsx";
import IdentityPage from "@/pages/Servers/components/ServerDialog/pages/IdentityPage.jsx";
import SettingsPage from "@/pages/Servers/components/ServerDialog/pages/SettingsPage.jsx";
import InheritancePolicyDialog from "@/pages/Servers/components/InheritancePolicyDialog/InheritancePolicyDialog.jsx";
import { getFieldConfig } from "@/pages/Servers/components/ServerDialog/utils/fieldConfig.js";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { mdiAccountKey, mdiChevronDown, mdiCogOutline, mdiLanConnect, mdiFormTextbox, mdiFolderCog } from "@mdi/js";
import Icon from "@mdi/react";
import "./styles.sass";

const PROTOCOL_OPTIONS = [
    { label: "SSH", value: "ssh" },
    { label: "Telnet", value: "telnet" },
    { label: "RDP", value: "rdp" },
    { label: "VNC", value: "vnc" },
    { label: "SFTP", value: "sftp" },
    { label: "FTP", value: "ftp" },
    { label: "FTPS", value: "ftps" },
];

const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const DETAIL_FIELDS = new Set(["engineId", "ip", "port", "macAddress", "wolBroadcastAddress"]);
const INHERITANCE_SECTIONS = ["details", "identities", "settings"];

const getSavedSectionState = (sections, profiles, identityProfiles, protocol, section) => {
    if (Object.hasOwn(sections?.[protocol] || {}, section)) return sections[protocol][section] ? "enabled" : "disabled";
    if (section === "identities") return Object.hasOwn(identityProfiles || {}, protocol) ? "enabled" : "transparent";
    const profile = profiles?.[protocol] || {};
    return Object.keys(profile).some((key) => section === "details" ? DETAIL_FIELDS.has(key) : !DETAIL_FIELDS.has(key))
        ? "enabled"
        : "transparent";
};

const buildSectionSnapshot = (protocols, sections, profiles, identityProfiles) => Object.fromEntries(
    protocols.map((profileProtocol) => [profileProtocol, Object.fromEntries(
        INHERITANCE_SECTIONS.map((section) => [section, getSavedSectionState(sections, profiles, identityProfiles, profileProtocol, section)])
    )])
);

const getApiSectionSnapshot = (protocols, states, key, fallback) => Object.fromEntries(
    protocols.map((profileProtocol) => [profileProtocol, Object.fromEntries(
        INHERITANCE_SECTIONS.map((section) => [section, states?.[profileProtocol]?.[section]?.[key] || fallback(profileProtocol, section)])
    )])
);

const buildProfileSettings = (profiles, monitoringUpdates) => {
    const settings = {};
    const protocols = new Set([...Object.keys(profiles), ...Object.keys(monitoringUpdates)]);
    for (const profileProtocol of protocols) {
        const profile = { ...profiles[profileProtocol] };
        if (Object.hasOwn(monitoringUpdates, profileProtocol)) {
            profile.monitoringEnabled = monitoringUpdates[profileProtocol];
        }
        if (Object.keys(profile).length) settings[profileProtocol] = profile;
    }
    return settings;
};

const findFolderById = (entries, folderId) => {
    for (const entry of entries || []) {
        if (entry.type === "folder" && String(entry.id) === String(folderId)) return entry;
        const found = entry.entries && findFolderById(entry.entries, folderId);
        if (found) return found;
    }
    return null;
};

const collectServerIds = (entries = []) => entries.flatMap((entry) => {
    if (entry.type === "server") return [entry.id];
    return entry.entries ? collectServerIds(entry.entries) : [];
});

const ProfilePicker = ({ value, onChange, dialogOpen }) => {
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState(null);
    const pickerRef = useRef(null);
    const selected = PROTOCOL_OPTIONS.find((option) => option.value === value) || PROTOCOL_OPTIONS[0];
    const menuOpen = open && dialogOpen;

    useEffect(() => {
        if (!menuOpen) return;
        const updatePosition = () => {
            const rect = pickerRef.current?.getBoundingClientRect();
            if (rect) setMenuPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
        };
        const closePicker = (event) => {
            if (!pickerRef.current?.contains(event.target) && !event.target.closest(".folder-profile-picker-options")) setOpen(false);
        };
        updatePosition();
        document.addEventListener("mousedown", closePicker);
        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        return () => {
            document.removeEventListener("mousedown", closePicker);
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
        };
    }, [menuOpen]);

    return <div className="folder-profile-picker" data-dialog-action ref={pickerRef}>
        <button type="button" className="folder-profile-picker-trigger" aria-haspopup="listbox" aria-expanded={menuOpen} onClick={() => setOpen((current) => !current)}>
            <span>{selected.label}</span>
            <Icon path={mdiChevronDown} className={menuOpen ? "open" : ""} />
        </button>
        {menuOpen && menuPosition && createPortal(<div className="folder-profile-picker-options" data-dialog-action role="listbox" style={menuPosition}>
            {PROTOCOL_OPTIONS.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "selected" : ""} onClick={() => { onChange(option.value); setOpen(false); }}>
                {option.label}
            </button>)}
        </div>, document.body)}
    </div>;
};

const FolderInheritanceDialog = ({ open, onClose, folderId, organizationId }) => {
    const { t } = useTranslation();
    const { servers, loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();
    const [name, setName] = useState("");
    const [initialName, setInitialName] = useState("");
    const [folderOrganizationId, setFolderOrganizationId] = useState(organizationId || null);
    const [profiles, setProfiles] = useState({});
    const [initialProfiles, setInitialProfiles] = useState({});
    const [inheritedProfiles, setInheritedProfiles] = useState({});
    const [identityProfiles, setIdentityProfiles] = useState({});
    const [initialIdentityProfiles, setInitialIdentityProfiles] = useState({});
    const [inheritedIdentityProfiles, setInheritedIdentityProfiles] = useState({});
    const [rawConfig, setRawConfig] = useState({});
    const [protocol, setProtocol] = useState("ssh");
    const [identityUpdates, setIdentityUpdates] = useState({});
    const [monitoringUpdates, setMonitoringUpdates] = useState({});
    const [activeTab, setActiveTab] = useState(0);
    const [hasParent, setHasParent] = useState(false);
    const [sectionEnabled, setSectionEnabled] = useState({});
    const [initialSectionEnabled, setInitialSectionEnabled] = useState({});
    const [initialSectionSnapshot, setInitialSectionSnapshot] = useState({});
    const [initialEffectiveSnapshot, setInitialEffectiveSnapshot] = useState({});
    const [inheritedSectionStates, setInheritedSectionStates] = useState({});
    const [pendingPolicies, setPendingPolicies] = useState({});
    const [policyPrompt, setPolicyPrompt] = useState(null);
    const [affectedEntryCounts, setAffectedEntryCounts] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    const selectedFolder = useMemo(() => findFolderById(servers, folderId), [servers, folderId]);
    const excludedJumpHostIds = useMemo(() => collectServerIds(selectedFolder?.entries), [selectedFolder]);
    const hasAffectedSubObjects = (targetProtocol, section) => {
        const count = affectedEntryCounts?.[targetProtocol]?.[section];
        return count === undefined ? true : count > 0;
    };

    const localProfile = useMemo(() => profiles[protocol] || {}, [profiles, protocol]);
    const inheritedConfig = useMemo(() => inheritedProfiles[protocol] || {}, [inheritedProfiles, protocol]);
    const config = useMemo(() => ({ ...inheritedConfig, ...localProfile }), [inheritedConfig, localProfile]);
    const localSectionState = (targetProtocol, section) => {
        const explicit = sectionEnabled[targetProtocol]?.[section];
        if (explicit !== undefined) return explicit ? "enabled" : "disabled";
        if (section === "identities") return Object.hasOwn(identityProfiles, targetProtocol) ? "enabled" : "transparent";
        const profile = profiles[targetProtocol] || {};
        return Object.keys(profile).some((key) => section === "details" ? DETAIL_FIELDS.has(key) : !DETAIL_FIELDS.has(key))
            ? "enabled"
            : "transparent";
    };
    const parentSectionEnabled = (targetProtocol, section) => inheritedSectionStates?.[targetProtocol]?.[section]?.effective === "enabled";
    const effectiveSectionEnabled = (targetProtocol, section) => {
        const local = localSectionState(targetProtocol, section);
        if (local === "enabled") return true;
        if (local === "disabled") return false;
        return parentSectionEnabled(targetProtocol, section);
    };
    const hasMonitoringUpdate = Object.hasOwn(monitoringUpdates, protocol);
    const monitoringEnabled = hasMonitoringUpdate
        ? monitoringUpdates[protocol]
        : Boolean(config.monitoringEnabled ?? inheritedConfig.monitoringEnabled);
    const identityLocalState = localSectionState(protocol, "identities");
    const identities = identityLocalState === "transparent"
        ? inheritedIdentityProfiles[protocol] || []
        : identityProfiles[protocol] || [];
    const inheritedIdentities = inheritedIdentityProfiles[protocol] || [];
    const fieldConfig = { ...getFieldConfig("server", protocol), showProtocol: false };
    const overrides = useMemo(() => hasParent ? Object.keys(localProfile) : [], [hasParent, localProfile]);
    const identityOverride = hasParent && !equal(identities, inheritedIdentities);
    const pendingProfileSettings = useMemo(() => buildProfileSettings(profiles, monitoringUpdates), [profiles, monitoringUpdates]);
    const isDirty = name !== initialName
        || !equal(sectionEnabled, initialSectionEnabled)
        || !equal(pendingProfileSettings, initialProfiles)
        || !equal(identityProfiles, initialIdentityProfiles)
        || Object.keys(identityUpdates).length > 0;
    const tabs = [
        { key: "general", label: t("servers.folderSettings.tabs.folder", "Folder"), icon: mdiFolderCog },
        { key: "details", label: t("servers.folderSettings.sections.connection", "Connection"), icon: mdiLanConnect },
        { key: "identities", label: t("servers.dialog.tabs.identities"), icon: mdiAccountKey },
        { key: "settings", label: t("servers.dialog.tabs.settings"), icon: mdiCogOutline },
    ];
    const activeSection = [null, "details", "identities", "settings"][activeTab];

    const isSectionEnabled = (section) => effectiveSectionEnabled(protocol, section);
    const setSectionState = (targetProtocol, section, state, policy) => {
        if (state === "transparent" && section === "identities") {
            setIdentityProfiles((current) => {
                const next = { ...current };
                delete next[targetProtocol];
                return next;
            });
        } else if (state === "transparent") {
            setProfiles((current) => {
                const nextProfile = Object.fromEntries(Object.entries(current[targetProtocol] || {}).filter(([key]) =>
                    section === "details" ? !DETAIL_FIELDS.has(key) : DETAIL_FIELDS.has(key)
                ));
                return { ...current, [targetProtocol]: nextProfile };
            });
        } else if (state === "enabled" && section === "identities") {
            setIdentityProfiles((current) => ({
                ...current,
                [targetProtocol]: [...(current[targetProtocol] || inheritedIdentityProfiles[targetProtocol] || [])],
            }));
        } else if (state === "enabled") {
            setProfiles((current) => {
                const local = current[targetProtocol] || {};
                const effective = { ...inheritedProfiles[targetProtocol], ...local };
                const nextProfile = Object.fromEntries(Object.entries(local).filter(([key]) =>
                    section === "details" ? !DETAIL_FIELDS.has(key) : DETAIL_FIELDS.has(key)
                ));
                for (const [key, value] of Object.entries(effective)) {
                    if ((section === "details") === DETAIL_FIELDS.has(key)) nextProfile[key] = value;
                }
                return { ...current, [targetProtocol]: nextProfile };
            });
        }
        if (state === "transparent" && section === "settings") {
            setMonitoringUpdates((current) => {
                const next = { ...current };
                delete next[targetProtocol];
                return next;
            });
        }
        setSectionEnabled((current) => ({
            ...current,
            [targetProtocol]: state === "transparent"
                ? Object.fromEntries(Object.entries(current[targetProtocol] || {}).filter(([key]) => key !== section))
                : { ...current[targetProtocol], [section]: state === "enabled" },
        }));
        if (policy) setPendingPolicies((current) => ({ ...current, [`${targetProtocol}:${section}`]: policy }));
    };

    const toggleSection = (section) => {
        const enabled = isSectionEnabled(section);
        const key = `${protocol}:${section}`;
        if (enabled) {
            setSectionState(protocol, section, "disabled");
            setPendingPolicies((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
            return;
        }
        const targetState = parentSectionEnabled(protocol, section) ? "transparent" : "enabled";
        const needsPolicy = initialEffectiveSnapshot[protocol]?.[section] !== "enabled";
        if (!hasAffectedSubObjects(protocol, section) || !needsPolicy) {
            setSectionState(protocol, section, targetState, needsPolicy ? "retain" : undefined);
            return;
        }
        setPolicyPrompt({ protocol, section, targetState });
    };
    const setProfileConfig = (update) => {
        if (activeSection && localSectionState(protocol, activeSection) !== "enabled") setSectionState(protocol, activeSection, "enabled");
        setProfiles((current) => {
            const next = typeof update === "function" ? update(current[protocol] || {}) : update;
            const profile = { ...next };
            delete profile.protocol;
            return { ...current, [protocol]: profile };
        });
    };

    const resetOverride = (key) => {
        setProfileConfig((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        if (key === "monitoringEnabled") setMonitoringUpdates((current) => {
            const next = { ...current };
            delete next[protocol];
            return next;
        });
    };

    const setProfileIdentities = (update) => {
        if (localSectionState(protocol, "identities") !== "enabled") setSectionState(protocol, "identities", "enabled");
        setIdentityProfiles((current) => ({
            ...current,
            [protocol]: typeof update === "function" ? update(current[protocol] || inheritedIdentities) : update,
        }));
    };

    const useParentSettings = () => {
        if (!activeSection) return;
        const needsPolicy = initialEffectiveSnapshot[protocol]?.[activeSection] !== "enabled"
            && parentSectionEnabled(protocol, activeSection);
        if (needsPolicy && hasAffectedSubObjects(protocol, activeSection)) {
            setPolicyPrompt({ protocol, section: activeSection, targetState: "transparent" });
            return;
        }
        setSectionState(protocol, activeSection, "transparent", needsPolicy ? "retain" : undefined);
        setPendingPolicies((current) => {
            const next = { ...current };
            delete next[`${protocol}:${activeSection}`];
            return next;
        });
    };

    useEffect(() => {
        if (!open || !folderId) return;

        let cancelled = false;
        setIsLoading(true);
        setHasParent(false);
        setAffectedEntryCounts(null);
        setName("");
        setInitialName("");
        setFolderOrganizationId(organizationId || null);
        setProfiles({});
        setInitialProfiles({});
        setInheritedProfiles({});
        setIdentityProfiles({});
        setInitialIdentityProfiles({});
        setInheritedIdentityProfiles({});
        setRawConfig({});
        setProtocol("ssh");
        setMonitoringUpdates({});
        setIdentityUpdates({});
        setSectionEnabled({});
        setInitialSectionEnabled({});
        setInitialSectionSnapshot({});
        setInitialEffectiveSnapshot({});
        setInheritedSectionStates({});
        setPendingPolicies({});
        setPolicyPrompt(null);
        setActiveTab(0);
        getRequest(`folders/${folderId}`).then((folder) => {
            const rawFolderConfig = folder.rawConfig || {};
            if (cancelled) return;
            const savedInheritance = rawFolderConfig.__nextermInheritance || {};
            const savedSections = savedInheritance.sectionEnabled || {};
            const localProfiles = folder.localProfiles || savedInheritance.profiles || {};
            const localIdentityProfiles = folder.localIdentityProfiles || {};
            const availableProtocols = [...new Set([
                ...Object.keys(localProfiles),
                ...Object.keys(localIdentityProfiles),
                ...Object.keys(savedSections),
                ...Object.keys(folder.inheritedProfiles || {}),
                ...Object.keys(folder.inheritedIdentityProfiles || {}),
                ...Object.keys(folder.sectionStates || {}),
                ...Object.keys(folder.inheritedSectionStates || {}),
                "ssh",
            ])];
            setProfiles(localProfiles);
            setInitialProfiles(buildProfileSettings(localProfiles, {}));
            setInheritedProfiles(folder.inheritedProfiles || {});
            setIdentityProfiles(localIdentityProfiles);
            setInitialIdentityProfiles(localIdentityProfiles);
            setInheritedIdentityProfiles(folder.inheritedIdentityProfiles || {});
            setInheritedSectionStates(folder.inheritedSectionStates || {});
            setRawConfig(rawFolderConfig);
            setSectionEnabled(savedSections);
            setInitialSectionEnabled(savedSections);
            const inferredLocalStates = buildSectionSnapshot(availableProtocols, savedSections, localProfiles, localIdentityProfiles);
            setInitialSectionSnapshot(getApiSectionSnapshot(availableProtocols, folder.sectionStates, "local", (profileProtocol, section) => inferredLocalStates[profileProtocol][section]));
            setInitialEffectiveSnapshot(getApiSectionSnapshot(availableProtocols, folder.sectionStates, "effective", (profileProtocol, section) => {
                const localState = inferredLocalStates[profileProtocol][section];
                if (localState === "enabled") return "enabled";
                if (localState === "disabled") return "disabled";
                return folder.inheritedSectionStates?.[profileProtocol]?.[section]?.effective || "disabled";
            }));
            setAffectedEntryCounts(folder.inheritanceAffectedEntryCounts || {});
            setName(folder.name || "");
            setInitialName(folder.name || "");
            setFolderOrganizationId(folder.organizationId || null);
            setHasParent(Boolean(folder.parentId));
            setProtocol(availableProtocols[0]);
            setMonitoringUpdates({});
            setIdentityUpdates({});
            setPendingPolicies({});
            setPolicyPrompt(null);
            setActiveTab(0);
            setIsLoading(false);
        }).catch((error) => {
            if (cancelled) return;
            setIsLoading(false);
            sendToast("Error", error.message || t("servers.messages.loadFailed", "Unable to load folder settings"));
            onClose();
        });
        return () => { cancelled = true; };
    }, [open, folderId, organizationId, onClose, sendToast, t]);

    const handleClose = () => {
        setPolicyPrompt(null);
        onClose();
    };

    const buildIdentityPayload = (identity) => ({
        name: identity.name,
        username: identity.authType === "password-only" ? undefined : identity.username,
        type: identity.authType,
        organizationId: identity.organizationId || undefined,
        ...(identity.passwordTouched || identity.password ? { password: identity.password } : {}),
        ...(identity.sshKey ? { sshKey: identity.sshKey } : {}),
        ...(identity.passphraseTouched || identity.passphrase ? { passphrase: identity.passphrase } : {}),
    });

    const buildIdentityCreates = () => Object.entries(identityUpdates)
        .filter(([identityId]) => identityId.startsWith("new-"))
        .map(([temporaryId, identity]) => ({ temporaryId, config: buildIdentityPayload(identity) }));

    const buildExistingIdentityUpdates = () => Object.entries(identityUpdates)
        .filter(([identityId]) => !identityId.startsWith("new-"))
        .map(([identityId, identity]) => ({ id: Number(identityId), config: buildIdentityPayload(identity) }));

    const save = async () => {
        if (isLoading || savingRef.current) return;
        if (!name.trim()) {
            sendToast("Error", t("servers.folderSettings.validation.nameRequired", "Folder name is required"));
            return;
        }
        savingRef.current = true;
        setIsSaving(true);
        try {
            const { __nextermInheritance, ...preservedConfig } = rawConfig;
            const inheritance = { ...__nextermInheritance };
            const profileSettings = pendingProfileSettings;

            const profileIdentities = Object.fromEntries(Object.entries(identityProfiles).map(([profileProtocol, ids]) => [
                profileProtocol,
                [...ids],
            ]));

            inheritance.profiles = profileSettings;
            inheritance.sectionEnabled = sectionEnabled;
            delete inheritance.config;
            delete inheritance.identityProfiles;
            delete inheritance.identities;

            const transitionProtocols = new Set([
                ...Object.keys(initialSectionSnapshot),
                ...Object.keys(sectionEnabled),
                ...Object.keys(profiles),
                ...Object.keys(identityProfiles),
            ]);
            const inheritanceTransitions = [];
            for (const profileProtocol of transitionProtocols) {
                for (const section of INHERITANCE_SECTIONS) {
                    const from = initialSectionSnapshot[profileProtocol]?.[section] || "transparent";
                    const to = getSavedSectionState(sectionEnabled, profiles, identityProfiles, profileProtocol, section);
                    if (from === to) continue;
                    inheritanceTransitions.push({
                        protocol: profileProtocol,
                        section,
                        from,
                        to,
                        ...((initialEffectiveSnapshot[profileProtocol]?.[section] || "disabled") === "disabled"
                            && (to === "enabled" || (to === "transparent" && parentSectionEnabled(profileProtocol, section)))
                            ? { policy: pendingPolicies[`${profileProtocol}:${section}`] || "retain" }
                            : {}),
                    });
                }
            }

            await patchRequest("folders/" + folderId, {
                name: name.trim(),
                identityProfiles: profileIdentities,
                identityCreates: buildIdentityCreates(),
                identityUpdates: buildExistingIdentityUpdates(),
                config: { ...preservedConfig, __nextermInheritance: inheritance },
                inheritanceTransitions,
            });
            loadIdentities();
            loadServers();
            sendToast("Success", t("servers.messages.folderUpdated", "Folder updated successfully"));
            handleClose();
        } catch (error) {
            sendToast("Error", error.message || t("servers.messages.updateFailed"));
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    };

    return <>
        <DialogProvider open={open} onClose={handleClose} isDirty={isDirty} disableClosing={isSaving}>
            <div className="server-dialog folder-inheritance-dialog">
                <div className="server-dialog-header">
                    <div className="dialog-icon"><Icon path={mdiFolderCog} size={1} /></div>
                    <div className="server-dialog-title"><h2>{t("servers.contextMenu.folderSettings", "Folder Settings")}</h2></div>
                    {activeSection && <div className="folder-inheritance-controls">
                        {hasParent && localSectionState(protocol, activeSection) !== "transparent" && <button type="button" className="folder-inheritance-use-parent" data-dialog-action onClick={useParentSettings}>
                            {t("servers.folderSettings.useParent", "Use parent settings")}
                        </button>}
                        <div className="folder-inheritance-toggle" data-dialog-action>
                            <label htmlFor="folder-inheritance-toggle">{t("servers.folderSettings.inherit", "Inherit")}</label>
                            <ToggleSwitch id="folder-inheritance-toggle" checked={isSectionEnabled(activeSection)} onChange={() => toggleSection(activeSection)} />
                        </div>
                        <div className="folder-inheritance-profile" data-dialog-action>
                            <ProfilePicker key={open ? "open" : "closed"} value={protocol} onChange={setProtocol} dialogOpen={open} />
                        </div>
                    </div>}
                </div>
                <div className="folder-inheritance-navigation">
                    <div className="server-dialog-tabs">
                        <TabSwitcher tabs={tabs.map((tab, index) => ({ ...tab, key: String(index) }))} activeTab={String(activeTab)} onTabChange={(tab) => setActiveTab(Number(tab))} variant="dialog" />
                    </div>
                </div>
                <form className="server-dialog-content" onSubmit={(event) => event.preventDefault()}>
                    {activeTab === 0 && <div className="folder-settings-general">
                        <div className="form-group"><label htmlFor="folder-name">{t("servers.folderSettings.fields.name", "Folder name")}</label><Input icon={mdiFormTextbox} id="folder-name" value={name} setValue={setName} placeholder={t("servers.folderSettings.placeholders.name", "Folder name")} /></div>
                    </div>}
                    {activeTab === 1 && <div className={isSectionEnabled("details") ? "folder-inheritance-section-content" : "folder-inheritance-section-content disabled"} aria-disabled={!isSectionEnabled("details")}><DetailsPage config={config} setConfig={setProfileConfig} fieldConfig={fieldConfig} showNameIcon={false} overrides={overrides} onReset={resetOverride} inheritedConfig={inheritedConfig} /></div>}
                    {activeTab === 2 && <div className={isSectionEnabled("identities") ? "folder-inheritance-section-content" : "folder-inheritance-section-content disabled"} aria-disabled={!isSectionEnabled("identities")}><IdentityPage serverIdentities={identities} setIdentityUpdates={setIdentityUpdates} identityUpdates={identityUpdates} setIdentities={setProfileIdentities} currentOrganizationId={folderOrganizationId} allowedAuthTypes={fieldConfig.allowedAuthTypes} serverName="" inheritedIdentities={inheritedIdentities} identityOverride={identityOverride} specificIdentities={identityProfiles[protocol] || []} visibleNewIdentityIds={identityProfiles[protocol] || []} onAddIdentity={(temporaryId) => {
                        setProfileIdentities((current) => current.includes(temporaryId) ? current : [...current, temporaryId]);
                    }} allowIdentityMoves={false} /></div>}
                    {activeTab === 3 && <div className={isSectionEnabled("settings") ? "folder-inheritance-section-content" : "folder-inheritance-section-content disabled"} aria-disabled={!isSectionEnabled("settings")}><SettingsPage config={{ ...config, protocol }} setConfig={setProfileConfig} monitoringEnabled={monitoringEnabled} setMonitoringEnabled={(value) => {
                        if (localSectionState(protocol, "settings") !== "enabled") setSectionState(protocol, "settings", "enabled");
                        setMonitoringUpdates((current) => ({ ...current, [protocol]: value }));
                    }} fieldConfig={fieldConfig} editServerId={null} overrides={overrides} onReset={resetOverride} inheritedConfig={inheritedConfig} restrictJumpHostsToScope jumpHostOrganizationId={folderOrganizationId} excludedJumpHostIds={excludedJumpHostIds} /></div>}
                </form>
                <Button className="server-dialog-button" onClick={save} disabled={isLoading || isSaving} text={t("servers.dialog.actions.save")} />
            </div>
        </DialogProvider>
        <InheritancePolicyDialog
            open={open && Boolean(policyPrompt)}
            title={t("servers.inheritancePolicy.enableTitle", "Enable inheritance?")}
            description={t("servers.inheritancePolicy.enableDescription", "Choose how existing sub-objects should handle this section. The choice will only be applied when Folder Settings is saved.")}
            onCancel={() => setPolicyPrompt(null)}
            onConfirm={(policy) => {
                if (!policyPrompt) return;
                const { protocol: promptProtocol, section, targetState } = policyPrompt;
                setSectionState(promptProtocol, section, targetState, policy);
                setPolicyPrompt(null);
            }}
        />
    </>;
};

export default FolderInheritanceDialog;
