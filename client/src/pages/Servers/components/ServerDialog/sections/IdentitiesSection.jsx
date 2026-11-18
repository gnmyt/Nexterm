import { mdiAccountCircleOutline, mdiFileUploadOutline, mdiLockOutline, mdiPlus, mdiTrashCan, mdiLinkOff, mdiLink, mdiAccountGroup, mdiAccountLockOutline, mdiAccountArrowRight, mdiAccountKeyOutline, mdiEarth, mdiKeyVariant, mdiFolderOutline } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import { SectionBlock, SettingRow } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";
import Tooltip from "@/common/components/Tooltip";
import { useToast } from "@/common/contexts/ToastContext.jsx";

const isNewId = (id) => !id || String(id).startsWith("new-");

export const buildIdentityPayload = (identity, fallbackName = "") => {
    const authType = identity.authType || identity.type;
    const username = authType === "password-only" ? undefined : (identity.username || undefined);
    const payload = {
        name: identity.name?.trim() || username || fallbackName,
        username,
        type: authType,
    };
    if (identity.organizationId) payload.organizationId = identity.organizationId;

    const usesPassword = authType !== "ssh";
    const usesKey = authType === "ssh" || authType === "both";
    if (usesPassword && (identity.passwordTouched || identity.password)) payload.password = identity.password;
    if (usesKey && identity.sshKey) payload.sshKey = identity.sshKey;
    if (usesKey && identity.passphrase) payload.passphrase = identity.passphrase;
    if (usesKey && identity.sshCertificate !== undefined) payload.sshCertificate = identity.sshCertificate;
    return payload;
};

export const buildServerIdentities = (identityIds, identityUpdates, knownIdentities, serverName) => identityIds.map((id) => {
    const draft = identityUpdates[id];
    if (!draft) return id;
    if (isNewId(id)) return { ...buildIdentityPayload(draft, serverName), global: draft.global };
    const saved = knownIdentities?.find(known => known.id === id);
    return {
        id,
        ...buildIdentityPayload({ ...saved, authType: saved?.type, ...draft }, serverName),
        ...(draft.global === undefined ? {} : { global: draft.global }),
    };
});

const Identity = ({ identity, onPatch, onDelete, onMoveToOrg, orgId, allowedAuthTypes, isInherited, isGlobal, onToggleGlobal, fallbackName }) => {
    const { t } = useTranslation();
    const isNew = isNewId(identity.id);
    const isOrg = identity.scope === "organization";
    const [name, setName] = useState(identity.name || "");
    const [username, setUsername] = useState(identity.username || "");
    const [authType, setAuthType] = useState(identity.authType || identity.type || (allowedAuthTypes?.[0] || "password"));
    const [password, setPassword] = useState(identity.password || "");
    const [sshKey, setSshKey] = useState(identity.sshKey || null);
    const [sshCertificate, setSshCertificate] = useState(identity.sshCertificate);
    const [passphrase, setPassphrase] = useState(identity.passphrase || "");
    const [pwTouched, setPwTouched] = useState(false);
    const [ppTouched, setPpTouched] = useState(false);
    const edited = useRef(false);
    const touch = (setter) => (value) => { edited.current = true; setter(value); };

    const allAuthOptions = [
        { label: t("servers.dialog.identities.passwordOnly"), value: "password-only" },
        { label: t("servers.dialog.identities.userPassword"), value: "password" },
        { label: t("servers.dialog.identities.sshKey"), value: "ssh" },
        { label: t("servers.dialog.identities.both"), value: "both" },
    ];

    const authOptions = allowedAuthTypes
        ? allAuthOptions.filter(opt => allowedAuthTypes.includes(opt.value))
        : allAuthOptions.filter(opt => ["password", "ssh", "both"].includes(opt.value));

    const readFile = (setter) => (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => touch(setter)(ev.target.result);
        reader.readAsText(file);
    };
    const certificate = sshCertificate !== undefined ? { sshCertificate } : {};

    useEffect(() => {
        if (!edited.current) return;
        onPatch(identity.id, {
            name, username, authType,
            ...(authType === "password" || authType === "password-only"
                ? { password, passwordTouched: pwTouched || isNew || password !== "" }
                : authType === "both"
                ? { password, passwordTouched: pwTouched || isNew || password !== "", sshKey, ...certificate, passphrase, passphraseTouched: ppTouched || passphrase !== "" }
                : { sshKey, ...certificate, passphrase, passphraseTouched: ppTouched || passphrase !== "" }),
        });
    }, [name, username, authType, password, sshKey, sshCertificate, passphrase, identity.id, pwTouched, ppTouched, isNew]);

    const showUsername = authType !== "password-only";
    const usesPassword = authType === "password" || authType === "password-only" || authType === "both";
    const usesKey = authType === "ssh" || authType === "both";
    const deletesIdentity = isNew || Boolean(identity.entryId);

    const isPrivate = Boolean(orgId) && !isOrg;
    const scopeIcon = isInherited ? mdiFolderOutline : isPrivate ? mdiAccountLockOutline : isGlobal && onToggleGlobal ? mdiEarth : mdiKeyVariant;
    const scopeHint = isInherited ? t("servers.dialog.identities.inheritedHint") : isPrivate ? t("servers.dialog.identities.onlyMeHint") : null;

    return (
        <div className="server-identity">
            <div className="server-identity__header">
                <Tooltip text={scopeHint} disabled={!scopeHint} delay={500} asChild>
                    <span className="server-identity__icon"><Icon path={scopeIcon} /></span>
                </Tooltip>
                <input className="server-identity__title" type="text" autoComplete="off" value={name} onChange={(e) => touch(setName)(e.target.value)}
                       placeholder={username || fallbackName || t("servers.dialog.identities.identityName")}
                       aria-label={t("servers.dialog.identities.identityName")} />
                {!isOrg && !isNew && orgId && onMoveToOrg && (
                    <Button icon={mdiAccountArrowRight} title={t("servers.dialog.identities.moveToOrg")} onClick={() => onMoveToOrg(identity.id, orgId)} />
                )}
                {!isInherited && (
                    <Button type="danger" icon={deletesIdentity ? mdiTrashCan : mdiLinkOff} onClick={() => onDelete(identity.id)}
                            title={t(deletesIdentity ? "servers.dialog.identities.removeIdentity" : "servers.dialog.identities.unlinkIdentity")} />
                )}
            </div>
            <div className="server-identity__fields">
                <div className={`sd-row${showUsername ? " sd-row--split" : ""}`}>
                    {showUsername && (
                        <Field label={t("servers.dialog.identities.username")}>
                            <Input icon={mdiAccountCircleOutline} type="text" placeholder={t("servers.dialog.identities.username")} autoComplete="off" value={username} setValue={touch(setUsername)} />
                        </Field>
                    )}
                    <Field label={t("servers.dialog.identities.authentication")}>
                        <SelectBox options={authOptions} selected={authType} setSelected={touch(setAuthType)} />
                    </Field>
                </div>
                {usesPassword && (
                    <Field label={t("servers.dialog.identities.passwordField")}>
                        <Input icon={mdiLockOutline} type="password" id={`identity-password-${identity.id}`} name="password" placeholder={t("servers.dialog.identities.passwordField")} autoComplete="new-password" value={password} setValue={(v) => { touch(setPassword)(v); setPwTouched(true); }} />
                    </Field>
                )}
                {usesKey && (
                    <div className="sd-row sd-row--split">
                        <Field label={t("servers.dialog.identities.sshPrivateKey")}>
                            <Input icon={mdiFileUploadOutline} type="file" autoComplete="off" onChange={readFile(setSshKey)} />
                        </Field>
                        <Field label={t("servers.dialog.identities.passphrase")}>
                            <Input icon={mdiLockOutline} type="password" id={`identity-passphrase-${identity.id}`} name="passphrase" placeholder={t("servers.dialog.identities.passphrase")} autoComplete="new-password" value={passphrase} setValue={(v) => { touch(setPassphrase)(v); setPpTouched(true); }} />
                        </Field>
                    </div>
                )}
                {usesKey && (
                    <Field label={t("servers.dialog.identities.sshCertificate")}>
                        <Input icon={mdiFileUploadOutline} type="file" autoComplete="off" onChange={readFile(setSshCertificate)} />
                        {identity.hasSshCertificate && sshCertificate === undefined && (
                            <Button type="secondary" size="small" text={t("servers.dialog.identities.removeCertificate")}
                                    onClick={() => touch(setSshCertificate)("")} />
                        )}
                    </Field>
                )}
            </div>
            {(onToggleGlobal || (isNew && orgId)) && (
                <div className="sd-settings server-identity__options">
                    {isNew && orgId && (
                        <SettingRow id={`identity-share-${identity.id}`} icon={mdiAccountGroup} checked={isOrg}
                                    label={t("servers.dialog.identities.shareToggle")}
                                    onChange={(share) => onPatch(identity.id, share ? { scope: "organization", organizationId: orgId } : { scope: "personal", organizationId: null })} />
                    )}
                    {onToggleGlobal && (
                        <SettingRow id={`identity-global-${identity.id}`} icon={mdiEarth} checked={isGlobal}
                                    label={t("servers.dialog.identities.globalToggle")}
                                    onChange={(global) => onToggleGlobal(identity, global)} />
                    )}
                </div>
            )}
        </div>
    );
};

const getAuthTypeLabel = (type, t) => {
    switch (type) {
        case "ssh": return t("servers.dialog.identities.sshKey");
        case "both": return t("servers.dialog.identities.both");
        case "password-only": return t("servers.dialog.identities.passwordOnly");
        default: return t("servers.dialog.identities.userPassword");
    }
};

const countIdentityUsage = (entries, counts = new Map()) => {
    (entries || []).forEach((entry) => {
        if (entry.entries) countIdentityUsage(entry.entries, counts);
        else (entry.identities || []).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return counts;
};

export const IdentityFields = ({ serverIdentities, specificIdentities = serverIdentities, setIdentityUpdates, identityUpdates, setIdentities, currentOrganizationId, allowedAuthTypes, serverName, allowMove = true, bindable = false }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();
    const { identities, moveIdentityToOrganization } = useContext(IdentityContext);
    const { servers } = useContext(ServerContext);
    const [showLinkable, setShowLinkable] = useState(false);

    const usage = useMemo(() => countIdentityUsage(servers), [servers]);
    const working = serverIdentities.map(id => ({ ...(identities?.find(i => i.id === id) || { id }), ...(identityUpdates[id] || {}) }));

    const linkable = (identities || []).filter(i => !i.entryId && !serverIdentities.includes(i.id)
        && (i.scope === "personal" || i.organizationId === currentOrganizationId)
        && (!allowedAuthTypes || allowedAuthTypes.includes(i.type)));

    const patch = (id, changes) => setIdentityUpdates(prev => ({ ...prev, [id]: { ...prev[id], ...changes } }));
    const handleDelete = (id) => {
        setIdentities(prev => prev.filter(i => i !== id));
        setIdentityUpdates(prev => { const n = { ...prev }; delete n[id]; return n; });
    };
    const toggleGlobal = (identity, global) => {
        if (!global && !isNewId(identity.id) && usage.get(identity.id) > 1) {
            sendToast("Error", t("servers.dialog.identities.globalInUse", { count: usage.get(identity.id) }));
            return;
        }
        patch(identity.id, { global });
    };
    const handleLink = (id) => setIdentities(prev => [...prev, id]);
    const handleMove = async (id, orgId) => {
        const result = await moveIdentityToOrganization(id, orgId);
        if (result.success) patch(id, { scope: "organization", organizationId: orgId });
    };
    const addNew = () => {
        const temporaryId = `new-${crypto.randomUUID()}`;
        setIdentities(prev => [...prev, temporaryId]);
        setIdentityUpdates(prev => ({
            ...prev,
            [temporaryId]: {
                name: "", username: "", authType: allowedAuthTypes?.[0] || "password", password: "", global: !bindable,
                scope: currentOrganizationId ? "organization" : "personal", organizationId: currentOrganizationId || null,
            },
        }));
    };

    return (
        <>
            {working.length > 0 ? (
                <div className="server-identity-list">
                    {working.map((identity) => {
                        const isInherited = !isNewId(identity.id) && !specificIdentities.includes(identity.id);
                        return (
                            <Identity key={identity.id} identity={identity} onPatch={patch} onDelete={handleDelete}
                                      onMoveToOrg={allowMove ? handleMove : null} orgId={currentOrganizationId} allowedAuthTypes={allowedAuthTypes}
                                      isInherited={isInherited} fallbackName={serverName}
                                      isGlobal={identity.global ?? !identity.entryId}
                                      onToggleGlobal={bindable && !isInherited ? toggleGlobal : null} />
                        );
                    })}
                </div>
            ) : (
                <p className="sd-muted">{t("servers.dialog.identities.empty")}</p>
            )}

            <div className="server-identity-actions">
                <Button type="secondary" size="small" text={t("servers.dialog.identities.add")} icon={mdiPlus} onClick={addNew} />
                {linkable.length > 0 && (
                    <Button type="secondary" size="small" icon={mdiLink} onClick={() => setShowLinkable(open => !open)}
                            text={t("servers.dialog.identities.linkGlobal", { count: linkable.length })} />
                )}
            </div>

            {showLinkable && linkable.length > 0 && (
                <div className="server-linkable">
                    {linkable.map((i) => (
                        <button type="button" key={i.id} className="server-linkable__item" onClick={() => handleLink(i.id)}>
                            <Icon path={mdiLink} />
                            <span className="server-linkable__name">{i.name}</span>
                            <span className="server-linkable__user">{i.username || t("servers.dialog.identities.noUsername")}</span>
                            {currentOrganizationId && i.scope === "personal" && (
                                <span className="server-badge server-badge--muted">{t("servers.dialog.identities.onlyMe")}</span>
                            )}
                            <span className="server-badge server-badge--muted">{getAuthTypeLabel(i.type, t)}</span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

const IdentitiesSection = (props) => {
    const { t } = useTranslation();
    return (
        <SectionBlock id="identities" icon={mdiAccountKeyOutline} title={t("servers.dialog.sections.identities")}>
            <IdentityFields {...props} />
        </SectionBlock>
    );
};

export default IdentitiesSection;
