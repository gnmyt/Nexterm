import { mdiAccountCircleOutline, mdiFileUploadOutline, mdiLockOutline, mdiPlus, mdiTrashCan, mdiLinkOff, mdiLink, mdiAccountGroup, mdiAccount, mdiAccountArrowRight, mdiAccountKeyOutline } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useRef, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";
import { SectionBlock } from "@/common/components/SectionedDialog";
import Field from "@/common/components/Field";

export const buildIdentityPayload = (identity) => {
    const payload = {
        name: identity.name,
        username: identity.authType === "password-only" ? undefined : (identity.username || undefined),
        type: identity.authType,
    };
    if (identity.organizationId) payload.organizationId = identity.organizationId;

    const usesPassword = identity.authType !== "ssh";
    const usesKey = identity.authType === "ssh" || identity.authType === "both";
    if (usesPassword && (identity.passwordTouched || identity.password)) payload.password = identity.password;
    if (usesKey && identity.sshKey) payload.sshKey = identity.sshKey;
    if (usesKey && identity.passphrase) payload.passphrase = identity.passphrase;
    return payload;
};

const Identity = ({ identity, onUpdate, onDelete, onMoveToOrg, isOrgContext, orgId, allowedAuthTypes, canUnlink }) => {
    const { t } = useTranslation();
    const isNew = !identity.id || String(identity.id).startsWith("new-");
    const isOrg = identity.scope === "organization";
    const [name, setName] = useState(identity.name || "");
    const [username, setUsername] = useState(identity.username || "");
    const [authType, setAuthType] = useState(identity.authType || identity.type || (allowedAuthTypes?.[0] || "password"));
    const [password, setPassword] = useState(identity.password || "");
    const [sshKey, setSshKey] = useState(identity.sshKey || null);
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

    const readFile = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => touch(setSshKey)(ev.target.result);
        reader.readAsText(e.target.files[0]);
    };

    useEffect(() => {
        if (!edited.current) return;
        onUpdate({
            id: identity.id, name, username, authType, scope: identity.scope, organizationId: identity.organizationId,
            ...(authType === "password" || authType === "password-only"
                ? { password, passwordTouched: pwTouched || isNew || password !== "" }
                : authType === "both"
                ? { password, passwordTouched: pwTouched || isNew || password !== "", sshKey, passphrase, passphraseTouched: ppTouched || passphrase !== "" }
                : { sshKey, passphrase, passphraseTouched: ppTouched || passphrase !== "" }),
        });
    }, [name, username, authType, password, sshKey, passphrase, identity.id, pwTouched, ppTouched, isNew]);

    const showUsername = authType !== "password-only";
    const usesPassword = authType === "password" || authType === "password-only" || authType === "both";
    const usesKey = authType === "ssh" || authType === "both";

    return (
        <div className={`server-identity${isOrg ? " server-identity--org" : ""}`}>
            <div className="server-identity__header">
                <span className="server-identity__scope" title={isOrg ? t("servers.dialog.identities.organizationIdentities") : t("servers.dialog.identities.personalIdentities")}>
                    <Icon path={isOrg ? mdiAccountGroup : mdiAccount} />
                </span>
                <div className="server-identity__name">
                    <Input icon={mdiAccountCircleOutline} value={name} setValue={touch(setName)} placeholder={t("servers.dialog.identities.identityName")} />
                </div>
                {isNew && <span className="server-badge">{t("servers.dialog.identities.new")}</span>}
                {!isOrg && !isNew && isOrgContext && orgId && onMoveToOrg && (
                    <Button icon={mdiAccountArrowRight} title={t("servers.dialog.identities.moveToOrg")} onClick={() => onMoveToOrg(identity.id, orgId)} />
                )}
                {canUnlink && (
                    <Button type="danger" icon={isNew ? mdiTrashCan : mdiLinkOff} onClick={() => onDelete(identity.id)}
                            title={t(isNew ? "servers.dialog.identities.removeIdentity" : "servers.dialog.identities.unlinkIdentity")} />
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
                            <Input icon={mdiFileUploadOutline} type="file" autoComplete="off" onChange={readFile} />
                        </Field>
                        <Field label={t("servers.dialog.identities.passphrase")}>
                            <Input icon={mdiLockOutline} type="password" id={`identity-passphrase-${identity.id}`} name="passphrase" placeholder={t("servers.dialog.identities.passphrase")} autoComplete="new-password" value={passphrase} setValue={(v) => { touch(setPassphrase)(v); setPpTouched(true); }} />
                        </Field>
                    </div>
                )}
            </div>
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

const IdentityGroup = ({ title, icon, description, identities, available, onUpdate, onDelete, onMoveToOrg, onLink, onAdd, isOrgContext, orgId, emptyText, t, allowedAuthTypes, specificIdentities }) => (
    <div className="sd-subsection">
        <div className="sd-subsection__header">
            <div>
                <h4><Icon path={icon} />{title}</h4>
                <p>{description}</p>
            </div>
            <Button type="secondary" size="small" text={t("servers.dialog.identities.new")} icon={mdiPlus} onClick={onAdd} />
        </div>

        {identities.length > 0 && (
            <div className="server-identity-list">
                {identities.map((i) => <Identity key={i.id} identity={i} onUpdate={onUpdate} onDelete={onDelete} onMoveToOrg={onMoveToOrg} isOrgContext={isOrgContext} orgId={orgId} allowedAuthTypes={allowedAuthTypes}
                                                       canUnlink={!i.id || String(i.id).startsWith("new-") || specificIdentities.includes(i.id)} />)}
            </div>
        )}

        {available.length > 0 && (
            <div className="server-linkable">
                <span className="server-linkable__label">{t("servers.dialog.identities.availableToLink")} · {available.length}</span>
                <div className="server-linkable__list">
                    {available.map((i) => (
                        <button type="button" key={i.id} className="server-linkable__item" onClick={() => onLink(i.id)}>
                            <Icon path={mdiLink} />
                            <span className="server-linkable__name">{i.name}</span>
                            <span className="server-linkable__user">{i.username || t("servers.dialog.identities.noUsername")}</span>
                            <span className="server-badge server-badge--muted">{getAuthTypeLabel(i.authType || i.type, t)}</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {identities.length === 0 && available.length === 0 && <p className="sd-muted">{emptyText}</p>}
    </div>
);

export const IdentityFields = ({ serverIdentities, specificIdentities = serverIdentities, setIdentityUpdates, identityUpdates, setIdentities, currentOrganizationId, allowedAuthTypes, serverName, allowMove = true, ownsNewIdentities = false }) => {
    const { t } = useTranslation();
    const { identities, personalIdentities, getOrganizationIdentities, moveIdentityToOrganization } = useContext(IdentityContext);

    const orgIdentities = currentOrganizationId ? getOrganizationIdentities(currentOrganizationId) : [];
    const linkedIds = new Set(serverIdentities.map(String));
    const working = [
        ...serverIdentities.map(id => ({ ...(identities?.find(i => i.id === id) || { id }), ...(identityUpdates[id] || {}) })),
        ...(ownsNewIdentities ? [] : Object.keys(identityUpdates).filter(k => k.startsWith("new-") && !linkedIds.has(k)).map(k => ({ id: k, ...identityUpdates[k] }))),
    ];
    const linkedOrg = working.filter(i => i.scope === "organization");
    const linkedPersonal = working.filter(i => i.scope === "personal");

    const filterByAllowedAuthTypes = (list) => allowedAuthTypes ? list.filter(i => allowedAuthTypes.includes(i.authType || i.type)) : list;
    const availableOrg = filterByAllowedAuthTypes(orgIdentities.filter(i => !serverIdentities.includes(i.id)));
    const availablePersonal = filterByAllowedAuthTypes(personalIdentities?.filter(i => !serverIdentities.includes(i.id)) || []);

    const handleUpdate = (u) => setIdentityUpdates(prev => ({ ...prev, [u.id]: u }));
    const handleDelete = (id) => {
        setIdentities(prev => prev.filter(i => i !== id));
        setIdentityUpdates(prev => { const n = { ...prev }; delete n[id]; return n; });
    };
    const handleLink = (id) => setIdentities(prev => [...prev, id]);
    const handleMove = async (id, orgId) => {
        const result = await moveIdentityToOrganization(id, orgId);
        if (result.success) setIdentityUpdates(prev => ({ ...prev, [id]: { ...prev[id], scope: "organization", organizationId: orgId } }));
    };
    const defaultAuthType = allowedAuthTypes?.[0] || "password";
    const addNew = (forOrg) => {
        const temporaryId = `new-${crypto.randomUUID()}`;
        if (ownsNewIdentities) setIdentities(prev => [...prev, temporaryId]);
        setIdentityUpdates(prev => ({
            ...prev, [temporaryId]: { name: serverName || "", username: "", authType: defaultAuthType, password: "", scope: forOrg ? "organization" : "personal", organizationId: forOrg ? currentOrganizationId : null }
        }));
    };

    const shared = { onUpdate: handleUpdate, onDelete: handleDelete, onMoveToOrg: allowMove ? handleMove : null, onLink: handleLink, t, allowedAuthTypes, specificIdentities };

    return (
        <>
            {currentOrganizationId && (
                <IdentityGroup title={t("servers.dialog.identities.organizationIdentities")} icon={mdiAccountGroup} description={t("servers.dialog.identities.orgDescription")}
                    identities={linkedOrg} available={availableOrg} onAdd={() => addNew(true)} isOrgContext={true} orgId={currentOrganizationId}
                    emptyText={t("servers.dialog.identities.noOrgIdentities")} {...shared} />
            )}
            <IdentityGroup title={t("servers.dialog.identities.personalIdentities")} icon={mdiAccount} description={t("servers.dialog.identities.personalDescription")}
                identities={linkedPersonal} available={availablePersonal} onAdd={() => addNew(false)} isOrgContext={!!currentOrganizationId} orgId={currentOrganizationId}
                emptyText={t("servers.dialog.identities.noPersonalIdentities")} {...shared} />
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
