import { mdiAccountCircleOutline, mdiFileUploadOutline, mdiLockOutline, mdiPlus, mdiTrashCan, mdiLinkOff, mdiLink, mdiAccountGroup, mdiAccount, mdiArrowRight } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import { useTranslation } from "react-i18next";

const Identity = ({ identity, onUpdate, onDelete, onMoveToOrg, isOrgContext, orgId }) => {
    const { t } = useTranslation();
    const isNew = !identity.id || String(identity.id).startsWith("new-");
    const isOrg = identity.scope === 'organization';
    const [name, setName] = useState(identity.name || (isNew ? "New Identity" : ""));
    const [username, setUsername] = useState(identity.username || "");
    const [authType, setAuthType] = useState(identity.authType || identity.type || "password");
    const [password, setPassword] = useState(identity.password || "");
    const [sshKey, setSshKey] = useState(identity.sshKey || null);
    const [passphrase, setPassphrase] = useState(identity.passphrase || "");
    const [pwTouched, setPwTouched] = useState(false);
    const [ppTouched, setPpTouched] = useState(false);

    const readFile = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => setSshKey(ev.target.result);
        reader.readAsText(e.target.files[0]);
    };

    useEffect(() => {
        onUpdate({
            id: identity.id, name, username, authType, scope: identity.scope, organizationId: identity.organizationId,
            ...(authType === "password" 
                ? { password, passwordTouched: pwTouched || isNew || password !== "" }
                : { sshKey, passphrase, passphraseTouched: ppTouched || isNew || passphrase !== "" }),
        });
    }, [name, username, authType, password, sshKey, passphrase, identity.id, pwTouched, ppTouched, isNew]);

    return (
        <div className={`identity identity-${isOrg ? 'organization' : 'personal'}`}>
            <div className="identity-header">
                <div className="identity-scope-icon">
                    <Icon path={isOrg ? mdiAccountGroup : mdiAccount} size={0.8} />
                </div>
                <div className="identity-name-input">
                    <Input icon={mdiAccountCircleOutline} value={name} setValue={setName} placeholder={t("servers.dialog.identities.identityName")} />
                </div>
                {isNew && <span className="new-badge">NEW</span>}
                {!isOrg && !isNew && isOrgContext && orgId && (
                    <button className="move-to-org-btn" onClick={() => onMoveToOrg(identity.id, orgId)} title={t("servers.dialog.identities.moveToOrg")} type="button">
                        <Icon path={mdiArrowRight} size={0.8} /><Icon path={mdiAccountGroup} size={0.8} />
                    </button>
                )}
                <button className="unlink-identity-btn" onClick={() => onDelete(identity.id)} title={t(isNew ? "servers.dialog.identities.removeIdentity" : "servers.dialog.identities.unlinkIdentity")} type="button">
                    <Icon path={isNew ? mdiTrashCan : mdiLinkOff} size={1} />
                </button>
            </div>
            <div className="identity-fields">
                <div className="identity-row">
                    <div className="form-group">
                        <label>{t("servers.dialog.identities.username")}</label>
                        <Input icon={mdiAccountCircleOutline} type="text" placeholder={t("servers.dialog.identities.username")} autoComplete="off" value={username} setValue={setUsername} />
                    </div>
                    <div className="form-group">
                        <label>{t("servers.dialog.identities.authentication")}</label>
                        <SelectBox options={[{ label: t("servers.dialog.identities.password"), value: "password" }, { label: t("servers.dialog.identities.sshKey"), value: "ssh" }]} selected={authType} setSelected={setAuthType} />
                    </div>
                </div>
                {authType === "password" && (
                    <div className="form-group">
                        <label>{t("servers.dialog.identities.password")}</label>
                        <Input icon={mdiLockOutline} type="password" placeholder={t("servers.dialog.identities.password")} autoComplete="new-password" value={password} setValue={(v) => { setPassword(v); setPwTouched(true); }} />
                    </div>
                )}
                {authType === "ssh" && (
                    <>
                        <div className="form-group">
                            <label>{t("servers.dialog.identities.sshPrivateKey")}</label>
                            <Input icon={mdiFileUploadOutline} type="file" autoComplete="off" onChange={readFile} />
                        </div>
                        <div className="form-group">
                            <label>{t("servers.dialog.identities.passphrase")}</label>
                            <Input icon={mdiLockOutline} type="password" placeholder={t("servers.dialog.identities.passphrase")} autoComplete="new-password" value={passphrase} setValue={(v) => { setPassphrase(v); setPpTouched(true); }} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const IdentitySection = ({ title, icon, description, identities, available, onUpdate, onDelete, onMoveToOrg, onLink, onAdd, isOrgContext, orgId, emptyText, t }) => (
    <div className={`identities-section ${icon === mdiAccountGroup ? 'organization-section' : 'personal-section'}`}>
        <div className="identities-header">
            <div className="section-title"><Icon path={icon} size={0.9} /><h3>{title}</h3></div>
            <Button text={t("servers.dialog.identities.new")} icon={mdiPlus} onClick={onAdd} />
        </div>
        {(identities.length > 0 || available.length === 0) && <p className="section-description">{description}</p>}
        <div className="identities-list">
            {identities.map((i) => <Identity key={i.id} identity={i} onUpdate={onUpdate} onDelete={onDelete} onMoveToOrg={onMoveToOrg} isOrgContext={isOrgContext} orgId={orgId} />)}
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
                                <div className="available-identity-type">{(i.authType || i.type) === "ssh" ? t("servers.dialog.identities.sshKey") : t("servers.dialog.identities.password")}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {identities.length === 0 && available.length === 0 && <div className="no-identities-inline"><p>{emptyText}</p></div>}
        </div>
    </div>
);

const IdentityPage = ({ serverIdentities, setIdentityUpdates, identityUpdates, setIdentities, currentOrganizationId }) => {
    const { t } = useTranslation();
    const { identities, personalIdentities, getOrganizationIdentities, moveIdentityToOrganization } = useContext(IdentityContext);

    const orgIdentities = currentOrganizationId ? getOrganizationIdentities(currentOrganizationId) : [];
    const working = [
        ...serverIdentities.map(id => ({ ...(identities?.find(i => i.id === id) || { id }), ...(identityUpdates[id] || {}) })),
        ...Object.keys(identityUpdates).filter(k => k.startsWith("new-")).map(k => ({ id: k, ...identityUpdates[k] })),
    ];
    const linkedOrg = working.filter(i => i.scope === 'organization');
    const linkedPersonal = working.filter(i => i.scope === 'personal');
    const availableOrg = orgIdentities.filter(i => !serverIdentities.includes(i.id));
    const availablePersonal = personalIdentities?.filter(i => !serverIdentities.includes(i.id)) || [];

    const handleUpdate = (u) => setIdentityUpdates(prev => ({ ...prev, [u.id]: u }));
    const handleDelete = (id) => {
        if (String(id).startsWith("new-")) {
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
    const addNew = (forOrg) => setIdentityUpdates(prev => ({
        ...prev, [`new-${Date.now()}`]: { name: "New Identity", username: "", authType: "password", password: "", scope: forOrg ? 'organization' : 'personal', organizationId: forOrg ? currentOrganizationId : null }
    }));

    return (
        <div className="identities">
            {currentOrganizationId && (
                <IdentitySection title={t("servers.dialog.identities.organizationIdentities")} icon={mdiAccountGroup} description={t("servers.dialog.identities.orgDescription")}
                    identities={linkedOrg} available={availableOrg} onUpdate={handleUpdate} onDelete={handleDelete} onMoveToOrg={handleMove} onLink={handleLink} onAdd={() => addNew(true)}
                    isOrgContext={true} orgId={currentOrganizationId} emptyText={t("servers.dialog.identities.noOrgIdentities")} t={t} />
            )}
            <IdentitySection title={t("servers.dialog.identities.personalIdentities")} icon={mdiAccount} description={t("servers.dialog.identities.personalDescription")}
                identities={linkedPersonal} available={availablePersonal} onUpdate={handleUpdate} onDelete={handleDelete} onMoveToOrg={handleMove} onLink={handleLink} onAdd={() => addNew(false)}
                isOrgContext={!!currentOrganizationId} orgId={currentOrganizationId} emptyText={t("servers.dialog.identities.noPersonalIdentities")} t={t} />
        </div>
    );
};

export default IdentityPage;
