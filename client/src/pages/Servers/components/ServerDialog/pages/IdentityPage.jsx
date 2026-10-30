import { mdiAccountCircleOutline, mdiFileUploadOutline, mdiLockOutline, mdiPlus, mdiTrashCan, mdiLinkOff, mdiLink, mdiAccountGroup, mdiAccount, mdiArrowRight, mdiContentDuplicate } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useRef, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import Tooltip from "@/common/components/Tooltip";
import { useTranslation } from "react-i18next";

const Identity = ({ identity, onUpdate, onDelete, onMoveToOrg, isOrgContext, orgId, allowedAuthTypes, canUnlink }) => {
    const { t } = useTranslation();
    const isNew = !identity.id || String(identity.id).startsWith("new-");
    const isOrg = identity.scope === 'organization';
    const [name, setName] = useState(identity.name || "");
    const [username, setUsername] = useState(identity.username || "");
    const [authType, setAuthType] = useState(identity.authType || identity.type || (allowedAuthTypes?.[0] || "password"));
    const [password, setPassword] = useState(identity.password || "");
    const [sshKey, setSshKey] = useState(identity.sshKey || null);
    const [passphrase, setPassphrase] = useState(identity.passphrase || "");
    const [pwTouched, setPwTouched] = useState(false);
    const [ppTouched, setPpTouched] = useState(false);
    const edited = useRef(false);

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
        reader.onload = (ev) => {
            edited.current = true;
            setSshKey(ev.target.result);
        };
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

    return (
        <div className={`identity identity-${isOrg ? 'organization' : 'personal'}`}>
            <div className="identity-header">
                <div className="identity-scope-icon">
                    <Icon path={isOrg ? mdiAccountGroup : mdiAccount} size={0.8} />
                </div>
                <div className="identity-name-input">
                    <Input icon={mdiAccountCircleOutline} value={name} setValue={(value) => { edited.current = true; setName(value); }} placeholder={t("servers.dialog.identities.identityName")} />
                </div>
                {isNew && <span className="new-badge">NEW</span>}
                {!isOrg && !isNew && isOrgContext && orgId && onMoveToOrg && (
                    <Tooltip text={t("servers.dialog.identities.moveToOrg")} delay={500} asChild>
                        <button className="move-to-org-btn" onClick={() => onMoveToOrg(identity.id, orgId)} aria-label={t("servers.dialog.identities.moveToOrg")} type="button">
                            <Icon path={mdiArrowRight} size={0.8} /><Icon path={mdiAccountGroup} size={0.8} />
                        </button>
                    </Tooltip>
                )}
                {canUnlink && <button className="unlink-identity-btn" onClick={() => onDelete(identity.id)} aria-label={t(isNew ? "servers.dialog.identities.removeIdentity" : "servers.dialog.identities.unlinkIdentity")} type="button">
                    <Icon path={isNew ? mdiTrashCan : mdiLinkOff} size={1} />
                </button>}
            </div>
            <div className="identity-fields">
                <div className={`identity-row ${!showUsername ? 'single-column' : ''}`}>
                    {showUsername && (
                        <div className="form-group">
                            <label>{t("servers.dialog.identities.username")}</label>
                            <Input icon={mdiAccountCircleOutline} type="text" placeholder={t("servers.dialog.identities.username")} autoComplete="off" value={username} setValue={(value) => { edited.current = true; setUsername(value); }} />
                        </div>
                    )}
                    <div className="form-group">
                        <label>{t("servers.dialog.identities.authentication")}</label>
                        <SelectBox options={authOptions} selected={authType} setSelected={(value) => { edited.current = true; setAuthType(value); }} />
                    </div>
                </div>
                {(authType === "password" || authType === "password-only" || authType === "both") && (
                    <div className="form-group">
                        <label>{t("servers.dialog.identities.passwordField")}</label>
                        <Input icon={mdiLockOutline} type="password" id={`identity-password-${identity.id}`} name="password" placeholder={t("servers.dialog.identities.passwordField")} autoComplete="new-password" value={password} setValue={(v) => { edited.current = true; setPassword(v); setPwTouched(true); }} />
                    </div>
                )}
                {(authType === "ssh" || authType === "both") && (
                    <>
                        <div className="form-group">
                            <label>{t("servers.dialog.identities.sshPrivateKey")}</label>
                            <Input icon={mdiFileUploadOutline} type="file" autoComplete="off" onChange={readFile} />
                        </div>
                        <div className="form-group">
                            <label>{t("servers.dialog.identities.passphrase")}</label>
                            <Input icon={mdiLockOutline} type="password" id={`identity-passphrase-${identity.id}`} name="passphrase" placeholder={t("servers.dialog.identities.passphrase")} autoComplete="new-password" value={passphrase} setValue={(v) => { edited.current = true; setPassphrase(v); setPpTouched(true); }} />
                        </div>
                    </>
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

const IdentitySection = ({ title, icon, description, identities, available, onUpdate, onDelete, onMoveToOrg, onLink, onAdd, isOrgContext, orgId, emptyText, t, allowedAuthTypes, specificIdentities }) => (
    <div className="identities-section">
        <div className="identities-header">
            <div className="section-title"><Icon path={icon} size={0.9} /><h3>{title}</h3></div>
            <Button text={t("servers.dialog.identities.new")} icon={mdiPlus} onClick={onAdd} />
        </div>
        {(identities.length > 0 || available.length === 0) && <p className="section-description">{description}</p>}
        <div className="identities-list">
            {identities.map((i) => <Identity key={i.id} identity={i} onUpdate={onUpdate} onDelete={onDelete} onMoveToOrg={onMoveToOrg} isOrgContext={isOrgContext} orgId={orgId} allowedAuthTypes={allowedAuthTypes} canUnlink={!i.id || String(i.id).startsWith("new-") || specificIdentities.includes(i.id)} />)}
            {available.length > 0 && (
                <div className={`available-identities-section ${identities.length === 0 ? 'no-border' : ''}`}>
                    <div className="available-identities-header">
                        <h4>{t("servers.dialog.identities.availableToLink")}</h4>
                        <span className="available-count">{available.length}</span>
                    </div>
                    <div className="available-identities-list">
                        {available.map((i) => (
                            <div key={i.id} className="available-identity" onClick={() => onLink(i.id)}>
                                <div className="available-identity-info">
                                    <div className="available-identity-name"><Icon path={mdiLink} size={0.7} />{i.name}</div>
                                    <div className="available-identity-username">{i.username || t("servers.dialog.identities.noUsername")}</div>
                                </div>
                                <div className="available-identity-type">{getAuthTypeLabel(i.authType || i.type, t)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {identities.length === 0 && available.length === 0 && <div className="no-identities-inline"><p>{emptyText}</p></div>}
        </div>
    </div>
);

const IdentityPage = ({ serverIdentities, setIdentityUpdates, identityUpdates, setIdentities, currentOrganizationId, allowedAuthTypes, serverName, inheritedIdentities = [], identityOverride, onEnableInheritance, canEnableInheritance = false, specificIdentities = serverIdentities, onAddIdentity, allowIdentityMoves = true, visibleNewIdentityIds = null }) => {
    const { t } = useTranslation();
    const { identities, personalIdentities, getOrganizationIdentities, moveIdentityToOrganization } = useContext(IdentityContext);

    const orgIdentities = currentOrganizationId ? getOrganizationIdentities(currentOrganizationId) : [];
    const linkedIds = new Set(serverIdentities.map(String));
    const visibleNewIds = visibleNewIdentityIds ? new Set(visibleNewIdentityIds.map(String)) : null;
    const working = [
        ...serverIdentities.map(id => ({ ...(identities?.find(i => i.id === id) || { id }), ...(identityUpdates[id] || {}) })),
        ...Object.keys(identityUpdates)
            .filter((id) => id.startsWith("new-") && !linkedIds.has(id) && (!visibleNewIds || visibleNewIds.has(id)))
            .map((id) => ({ id, ...identityUpdates[id] })),
    ];
    const linkedOrg = working.filter(i => i.scope === 'organization');
    const linkedPersonal = working.filter(i => i.scope === 'personal');

    const filterByAllowedAuthTypes = (list) => {
        if (!allowedAuthTypes) return list;
        return list.filter(i => allowedAuthTypes.includes(i.authType || i.type));
    };
    
    const availableOrg = filterByAllowedAuthTypes(orgIdentities.filter(i => !serverIdentities.includes(i.id)));
    const availablePersonal = filterByAllowedAuthTypes(personalIdentities?.filter(i => !serverIdentities.includes(i.id)) || []);

    const handleUpdate = (u) => setIdentityUpdates(prev => ({ ...prev, [u.id]: u }));
    const handleDelete = (id) => {
        if (String(id).startsWith("new-")) {
            setIdentities(prev => prev.filter(identityId => identityId !== id));
            setIdentityUpdates(prev => { const n = { ...prev }; delete n[id]; return n; });
        } else {
            setIdentities(prev => prev.filter(i => i !== id));
            setIdentityUpdates(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };
    const handleLink = (id) => setIdentities(prev => [...prev, id]);
    const handleMove = async (id, orgId) => {
        const result = await moveIdentityToOrganization(id, orgId);
        if (result.success) {
            setIdentityUpdates(prev => ({ ...prev, [id]: { ...prev[id], scope: 'organization', organizationId: orgId } }));
        }
    };
    const defaultAuthType = allowedAuthTypes?.[0] || "password";
    const addNew = (forOrg) => {
        const temporaryId = "new-" + (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        onAddIdentity?.(temporaryId);
        setIdentityUpdates(prev => ({
            ...prev, [temporaryId]: { name: serverName || "", username: "", authType: defaultAuthType, password: "", scope: forOrg ? 'organization' : 'personal', organizationId: forOrg ? currentOrganizationId : null }
        }));
    };

    return (
        <div className="identities">
            {canEnableInheritance && identityOverride && inheritedIdentities.length > 0 && <Button text={t("servers.dialog.identities.enableInheritance", "Enable inheritance")} icon={mdiContentDuplicate} onClick={onEnableInheritance} buttonType="button" />}
            {currentOrganizationId && (
                <IdentitySection title={t("servers.dialog.identities.organizationIdentities")} icon={mdiAccountGroup} description={t("servers.dialog.identities.orgDescription")}
                    identities={linkedOrg} available={availableOrg} onUpdate={handleUpdate} onDelete={handleDelete} onMoveToOrg={allowIdentityMoves ? handleMove : null} onLink={handleLink} onAdd={() => addNew(true)}
                    isOrgContext={true} orgId={currentOrganizationId} emptyText={t("servers.dialog.identities.noOrgIdentities")} t={t} allowedAuthTypes={allowedAuthTypes} specificIdentities={specificIdentities} />
            )}
            <IdentitySection title={t("servers.dialog.identities.personalIdentities")} icon={mdiAccount} description={t("servers.dialog.identities.personalDescription")}
                identities={linkedPersonal} available={availablePersonal} onUpdate={handleUpdate} onDelete={handleDelete} onMoveToOrg={allowIdentityMoves ? handleMove : null} onLink={handleLink} onAdd={() => addNew(false)}
                isOrgContext={!!currentOrganizationId} orgId={currentOrganizationId} emptyText={t("servers.dialog.identities.noPersonalIdentities")} t={t} allowedAuthTypes={allowedAuthTypes} specificIdentities={specificIdentities} />
        </div>
    );
};

export default IdentityPage;
