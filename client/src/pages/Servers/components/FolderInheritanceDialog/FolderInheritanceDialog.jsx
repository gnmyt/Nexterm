import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { mdiFolderCogOutline, mdiFormTextbox, mdiInformationOutline, mdiLanConnect } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { getRequest, patchRequest } from "@/common/utils/RequestUtil.js";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useUnsavedChanges } from "@/common/hooks/useUnsavedChanges.js";
import { getFieldConfig, getSections } from "@/pages/Servers/components/ServerDialog/utils/fieldConfig.js";
import SectionedDialog, { SectionBlock } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";
import { EngineField } from "@/pages/Servers/components/ServerDialog/sections/GeneralSection.jsx";
import { PortField, JumpHosts, PROTOCOL_OPTIONS } from "@/pages/Servers/components/ServerDialog/sections/ConnectionSection.jsx";
import IdentitiesSection, { buildIdentityPayload } from "@/pages/Servers/components/ServerDialog/sections/IdentitiesSection.jsx";
import TerminalSection from "@/pages/Servers/components/ServerDialog/sections/TerminalSection.jsx";
import DisplaySection from "@/pages/Servers/components/ServerDialog/sections/DisplaySection.jsx";
import OptionsSection from "@/pages/Servers/components/ServerDialog/sections/OptionsSection.jsx";

const isUnset = (value) => value === undefined || value === null || value === "";
const withoutUnset = (object) => Object.fromEntries(Object.entries(object || {}).filter(([, value]) => !isUnset(value)));
const withoutEmpty = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => Object.keys(value).length));

const findFolder = (entries, folderId) => {
    for (const entry of entries || []) {
        if (entry.type === "folder" && String(entry.id) === String(folderId)) return entry;
        const found = findFolder(entry.entries, folderId);
        if (found) return found;
    }
    return null;
};

const collectServerIds = (entries = []) => entries.flatMap((entry) =>
    entry.type === "server" ? [entry.id] : collectServerIds(entry.entries));

const normalizeDraft = (draft) => ({
    ...draft,
    profiles: withoutEmpty(draft.profiles),
    identityProfiles: withoutEmpty(draft.identityProfiles),
});

const FolderInheritanceDialog = ({ open, onClose, folderId }) => {
    const { t } = useTranslation();
    const { servers, loadServers } = useContext(ServerContext);
    const { loadIdentities } = useContext(IdentityContext);
    const { sendToast } = useToast();

    const [folder, setFolder] = useState(null);
    const [name, setName] = useState("");
    const [profiles, setProfiles] = useState({});
    const [identityProfiles, setIdentityProfiles] = useState({});
    const [identityUpdates, setIdentityUpdates] = useState({});
    const [protocol, setProtocol] = useState("ssh");
    const [isSaving, setIsSaving] = useState(false);
    const dialogRef = useRef(null);

    const draft = useMemo(() => ({ name, profiles, identityProfiles, identityUpdates }),
        [name, profiles, identityProfiles, identityUpdates]);
    const { isDirty, markClean, reset: resetDirty } = useUnsavedChanges(draft, { normalize: normalizeDraft });

    useEffect(() => {
        if (!open || !folderId) return;
        let cancelled = false;

        setFolder(null);
        resetDirty();
        getRequest(`folders/${folderId}`).then((loaded) => {
            if (cancelled) return;
            const initial = {
                name: loaded.name || "",
                profiles: loaded.localProfiles,
                identityProfiles: loaded.localIdentityProfiles,
                identityUpdates: {},
            };
            setFolder(loaded);
            setName(initial.name);
            setProfiles(initial.profiles);
            setIdentityProfiles(initial.identityProfiles);
            setIdentityUpdates({});
            setProtocol("ssh");
            markClean(initial);
            dialogRef.current?.scrollToTop();
        }).catch((error) => {
            if (cancelled) return;
            sendToast("Error", error.message || t("servers.folderSettings.loadFailed"));
            onClose();
        });
        return () => { cancelled = true; };
    }, [open, folderId]);

    const organizationId = folder?.organizationId || null;
    const fieldConfig = getFieldConfig("server", protocol);

    const localProfile = useMemo(() => profiles[protocol] || {}, [profiles, protocol]);
    const inheritedConfig = useMemo(() => folder?.inheritedProfiles?.[protocol] || {}, [folder, protocol]);
    const config = useMemo(() => ({ ...inheritedConfig, ...localProfile, protocol }), [inheritedConfig, localProfile, protocol]);

    const setConfig = (update) => setProfiles((current) => {
        const next = typeof update === "function" ? update(current[protocol] || {}) : update;
        return { ...current, [protocol]: withoutUnset({ ...next, protocol: undefined }) };
    });

    const inheritance = useMemo(() => ({
        inheritedConfig,
        overrides: Object.keys(localProfile),
        dimUnset: true,
        resetLabel: t("servers.folderSettings.unset"),
        onReset: (key) => setProfiles((current) => ({ ...current, [protocol]: withoutUnset({ ...current[protocol], [key]: undefined }) })),
    }), [inheritedConfig, localProfile, protocol, t]);

    const inheritedIdentities = folder?.inheritedIdentityProfiles?.[protocol] || [];
    const ownIdentities = identityProfiles[protocol] || [];
    const identities = ownIdentities.length ? ownIdentities : inheritedIdentities;
    const setIdentities = (update) => setIdentityProfiles((current) => {
        const base = current[protocol]?.length ? current[protocol] : inheritedIdentities;
        return { ...current, [protocol]: typeof update === "function" ? update(base) : update };
    });

    const ownServerIds = useMemo(() => new Set(collectServerIds(findFolder(servers, folderId)?.entries)), [servers, folderId]);
    const isAllowedJumpHost = useMemo(() => (server) =>
        (organizationId ? server.organizationId === organizationId : !server.organizationId) && !ownServerIds.has(server.id),
    [organizationId, ownServerIds]);

    const save = async () => {
        if (!folder || isSaving) return;
        if (!name.trim()) {
            sendToast("Error", t("servers.folderSettings.nameRequired"));
            return;
        }
        setIsSaving(true);
        try {
            const updates = Object.entries(identityUpdates);
            await patchRequest("folders/" + folderId, {
                name: name.trim(),
                profiles: withoutEmpty(profiles),
                identityProfiles: withoutEmpty(identityProfiles),
                identityCreates: updates.filter(([id]) => id.startsWith("new-"))
                    .map(([temporaryId, identity]) => ({ temporaryId, config: buildIdentityPayload(identity) })),
                identityUpdates: updates.filter(([id]) => !id.startsWith("new-"))
                    .map(([id, identity]) => ({ id: Number(id), config: buildIdentityPayload(identity) })),
            });
            loadIdentities();
            loadServers();
            sendToast("Success", t("servers.messages.folderUpdated"));
            onClose();
        } catch (error) {
            sendToast("Error", error.message || t("servers.messages.updateFailed"));
        } finally {
            setIsSaving(false);
        }
    };

    const sections = useMemo(() => getSections("server", protocol), [protocol]);
    const has = (key) => sections.some((section) => section.key === key);

    return (
        <SectionedDialog ref={dialogRef} open={open} onClose={onClose} isDirty={isDirty} disableClosing={isSaving} inheritance={inheritance}
                         icon={mdiFolderCogOutline} title={folder?.name || t("servers.contextMenu.folderSettings")}
                         subtitle={folder && t("servers.contextMenu.folderSettings")} sections={sections} ready={Boolean(folder)}
                         onSubmit={save} submitLabel={t("servers.dialog.actions.save")} submitDisabled={!folder || isSaving}>
            <SectionBlock id="general" icon={mdiInformationOutline} title={t("servers.dialog.sections.general")}>
                <Field label={t("servers.folderSettings.name")} htmlFor="folder-name">
                    <Input icon={mdiFormTextbox} id="folder-name" autoComplete="off" value={name} setValue={setName}
                           placeholder={t("servers.folderSettings.name")} />
                </Field>
                <Field label={t("servers.folderSettings.protocol")} hint={t("servers.folderSettings.protocolHint")}>
                    <SelectBox options={PROTOCOL_OPTIONS} selected={protocol} setSelected={setProtocol} />
                </Field>
            </SectionBlock>

            <SectionBlock id="connection" icon={mdiLanConnect} title={t("servers.dialog.sections.connection")}>
                <PortField config={config} setConfig={setConfig} />
                <EngineField config={config} setConfig={setConfig} />
                {protocol === "ssh" && <JumpHosts config={config} setConfig={setConfig} isAllowed={isAllowedJumpHost} />}
            </SectionBlock>

            {has("identities") && (
                <IdentitiesSection serverIdentities={identities} specificIdentities={ownIdentities} setIdentities={setIdentities}
                                   identityUpdates={identityUpdates} setIdentityUpdates={setIdentityUpdates}
                                   currentOrganizationId={organizationId} allowedAuthTypes={fieldConfig.allowedAuthTypes}
                                   allowMove={false} ownsNewIdentities />
            )}
            {has("terminal") && <TerminalSection config={config} setConfig={setConfig} />}
            {has("display") && <DisplaySection config={config} setConfig={setConfig} fieldConfig={fieldConfig} />}
            {has("options") && (
                <OptionsSection config={config} setConfig={setConfig} fieldConfig={fieldConfig}
                                monitoringEnabled={Boolean(config.monitoringEnabled)}
                                setMonitoringEnabled={(value) => setConfig((current) => ({ ...current, monitoringEnabled: value }))} />
            )}
        </SectionedDialog>
    );
};

export default FolderInheritanceDialog;
