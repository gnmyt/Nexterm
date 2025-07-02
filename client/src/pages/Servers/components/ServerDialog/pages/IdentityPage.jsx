import { mdiAccountCircleOutline, mdiFileUploadOutline, mdiLockOutline, mdiPlus, mdiTrashCan, mdiCheck, mdiLinkOff } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";

const Identity = ({ identity, isNew = false, onUpdate, onDelete, identityUpdates = {} }) => {
    const [identityName, setIdentityName] = useState(
        identityUpdates.name || identity?.name || (isNew ? "New Identity" : ""));
    const [identityUsername, setIdentityUsername] = useState(identityUpdates.username || identity?.username || "");
    const [authType, setAuthType] = useState(identityUpdates.authType || identity?.type || "password");
    const [identityPassword, setIdentityPassword] = useState(
        isNew ? "" : (identityUpdates.password !== undefined ? identityUpdates.password : "********"));
    const [identityKeyfile, setIdentityKeyfile] = useState(identityUpdates.sshKey || identity?.sshKey || null);
    const [identityPassphrase, setIdentityPassphrase] = useState(
        isNew ? "" : (identityUpdates.passphrase !== undefined ? identityUpdates.passphrase : "********"));

    const readFile = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            setIdentityKeyfile(e.target.result);
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        const updatedIdentity = {
            name: identityName,
            username: identityUsername,
            authType,
            ...(authType === "password"
                ? { password: identityPassword === "********" ? undefined : identityPassword }
                : {
                    sshKey: identityKeyfile,
                    passphrase: identityPassphrase === "********" ? undefined : identityPassphrase
                }
            )
        };
        onUpdate(updatedIdentity);
    }, [identityName, identityUsername, authType, identityPassword, identityKeyfile, identityPassphrase]);

    return (
        <div className="identity">
            <div className="identity-header">
                <Input icon={mdiAccountCircleOutline} value={identityName} setValue={setIdentityName} placeholder="Identity Name" />
                <button className="unlink-identity-btn" onClick={() => onDelete(isNew ? null : identity.id)}
                        title={isNew ? "Remove identity" : "Unlink identity"} type="button">
                    <Icon path={isNew ? mdiTrashCan : mdiLinkOff} size={0.8} />
                </button>
            </div>

            <div className="name-row">
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <Input icon={mdiAccountCircleOutline} type="text" placeholder="Username"
                           autoComplete="off" value={identityUsername} setValue={setIdentityUsername} />
                </div>

                <div className="form-group">
                    <label>Authentication</label>
                    <SelectBox options={[{ label: "Password", value: "password" }, { label: "SSH Key", value: "ssh" }]}
                               selected={authType} setSelected={setAuthType} />
                </div>
            </div>

            {authType === "password" && (
                <div className="password-row">
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <Input icon={mdiLockOutline} type="password" placeholder="Password"
                               autoComplete="off" value={identityPassword} setValue={setIdentityPassword} />
                    </div>
                </div>
            )}

            {authType === "ssh" && (
                <div className="keyfile-row">
                    <div className="form-group">
                        <label htmlFor="keyfile">SSH Private Key</label>
                        <Input icon={mdiFileUploadOutline} type="file"
                               autoComplete="off" onChange={readFile} />
                        {identityKeyfile && (
                            <div className="keyfile-status">
                                <Icon path={mdiCheck} />
                                <span>Key file loaded</span>
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label htmlFor="passphrase">Passphrase (optional)</label>
                        <Input icon={mdiLockOutline} type="password" placeholder="Passphrase"
                               autoComplete="off" value={identityPassphrase} setValue={setIdentityPassphrase} />
                    </div>
                </div>
            )}
        </div>
    );
};

const IdentityPage = ({ serverIdentities, setIdentityUpdates, identityUpdates, setIdentities }) => {
    const { identities } = useContext(IdentityContext);
    const [newIdentities, setNewIdentities] = useState([]);
    const [selectedIdentityToLink, setSelectedIdentityToLink] = useState("");

    const mappedIdentities = serverIdentities.map((identityId) => identities?.find((identity) => identity.id === identityId))
        .filter(Boolean);

    const availableIdentities = identities?.filter(identity => !serverIdentities.includes(identity.id)) || [];

    const handleIdentityUpdate = (identityId, updatedIdentity) => {
        setIdentityUpdates(updates => ({ ...updates, [identityId]: updatedIdentity }));
    };

    const handleNewIdentityUpdate = (index, updatedIdentity) => {
        setIdentityUpdates(updates => ({ ...updates, [`new-${index}`]: updatedIdentity }));
    };

    const addNewIdentity = () => {
        setNewIdentities(prev => [...prev, {}]);
    };

    const deleteNewIdentity = (index) => {
        setNewIdentities(prev => prev.filter((_, i) => i !== index));
        setIdentityUpdates(updates => {
            const newUpdates = { ...updates };
            delete newUpdates[`new-${index}`];
            return newUpdates;
        });
    };

    const linkExistingIdentity = () => {
        if (selectedIdentityToLink) {
            setIdentities(prev => [...prev, parseInt(selectedIdentityToLink)]);
            setSelectedIdentityToLink("");
        }
    };

    const unlinkIdentity = (identityId) => {
        setIdentities(prev => prev.filter(id => id !== identityId));
        setIdentityUpdates(updates => {
            const newUpdates = { ...updates };
            delete newUpdates[identityId];
            return newUpdates;
        });
    };

    return (
        <div className="identities">
            <div className="identities-header">
                <h3>Server Identities</h3>
                <div className="identity-actions">
                    <Button text="Add New Identity" icon={mdiPlus} onClick={addNewIdentity} className="add-identity-btn" />
                </div>
            </div>

            {availableIdentities.length > 0 && (
                <div className="link-identity-section">
                    <div className="link-identity-row">
                        <div className="form-group">
                            <label>Link Existing Identity</label>
                            <SelectBox selected={selectedIdentityToLink} setSelected={setSelectedIdentityToLink}
                                options={[
                                    { label: "Select an identity...", value: "" },
                                    ...availableIdentities.map(identity => ({
                                        label: `${identity.name} (${identity.username || 'No username'})`,
                                        value: identity.id.toString()
                                    }))
                                ]}

                            />
                        </div>
                        <Button text="Link" onClick={linkExistingIdentity} disabled={!selectedIdentityToLink} className="link-identity-btn" />
                    </div>
                </div>
            )}

            {mappedIdentities.map((identity) => (
                <Identity key={identity.id} identity={identity} identityUpdates={identityUpdates[identity.id] || {}}
                          onUpdate={(updatedIdentity) => handleIdentityUpdate(identity.id, updatedIdentity)}
                          onDelete={unlinkIdentity} />
            ))}

            {newIdentities.map((_, index) => (
                <Identity key={`new-${index}`} identity={{}} isNew={true} identityUpdates={identityUpdates[`new-${index}`] || {}}
                          onUpdate={(updatedIdentity) => handleNewIdentityUpdate(index, updatedIdentity)}
                          onDelete={() => deleteNewIdentity(index)} />
            ))}

            {mappedIdentities.length === 0 && newIdentities.length === 0 && (
                <div className="no-identities">
                    <p>No identities configured. Add a new identity or link an existing one.</p>
                </div>
            )}
        </div>
    );
};

export default IdentityPage;