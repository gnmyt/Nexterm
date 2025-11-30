import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
    mdiPlus,
    mdiTrashCan,
    mdiCheck,
    mdiLinkOff,
    mdiLink,
} from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";

const Identity = ({ identity, onUpdate, onDelete }) => {
    const isNew = !identity.id || (typeof identity.id === "string" && identity.id.startsWith("new-"));

    const [identityName, setIdentityName] = useState(identity.name || (isNew ? "New Identity" : ""));
    const [identityUsername, setIdentityUsername] = useState(identity.username || "");
    const [authType, setAuthType] = useState(identity.authType || identity.type || "password");
    const [identityPassword, setIdentityPassword] = useState(identity.password || "");
    const [identityKeyfile, setIdentityKeyfile] = useState(identity.sshKey || null);
    const [identityPassphrase, setIdentityPassphrase] = useState(identity.passphrase || "");
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [passphraseTouched, setPassphraseTouched] = useState(false);

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
            id: identity.id,
            name: identityName,
            username: identityUsername,
            authType,
            ...(authType === "password"
                    ? { 
                        password: identityPassword,
                        passwordTouched: passwordTouched || (isNew ? true : identityPassword !== "")
                    }
                    : {
                        sshKey: identityKeyfile,
                        passphrase: identityPassphrase,
                        passphraseTouched: passphraseTouched || (isNew ? true : identityPassphrase !== ""),
                    }
            ),
        };
        onUpdate(updatedIdentity);
    }, [identityName, identityUsername, authType, identityPassword, identityKeyfile, identityPassphrase, identity.id, passwordTouched, passphraseTouched, isNew]);

    return (
        <div className="identity">
            <div className="identity-header">
                <div className="identity-name-input">
                    <Input icon={mdiAccountCircleOutline} value={identityName} setValue={setIdentityName}
                           placeholder="Identity Name" />
                </div>
                {isNew && <span className="new-badge">NEW</span>}
                <button className="unlink-identity-btn" onClick={() => onDelete(identity.id)}
                        title={isNew ? "Remove identity" : "Unlink identity"} type="button">
                    <Icon path={isNew ? mdiTrashCan : mdiLinkOff} size={1} />
                </button>
            </div>

            <div className="identity-fields">
                <div className="identity-row">
                    <div className="form-group">
                        <label>Username</label>
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
                    <div className="form-group">
                        <label>Password</label>
                        <Input icon={mdiLockOutline} type="password" placeholder="Password"
                               autoComplete="off" value={identityPassword} 
                               setValue={(val) => { setIdentityPassword(val); setPasswordTouched(true); }} />
                    </div>
                )}

                {authType === "ssh" && (
                    <>
                        <div className="form-group">
                            <label>SSH Private Key</label>
                            <Input icon={mdiFileUploadOutline} type="file"
                                   autoComplete="off" onChange={readFile} />
                        </div>
                        <div className="form-group">
                            <label>Passphrase (optional)</label>
                            <Input icon={mdiLockOutline} type="password" placeholder="Passphrase"
                                   autoComplete="off" value={identityPassphrase} 
                                   setValue={(val) => { setIdentityPassphrase(val); setPassphraseTouched(true); }} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const IdentityPage = ({ serverIdentities, setIdentityUpdates, identityUpdates, setIdentities }) => {
    const { identities } = useContext(IdentityContext);

    const workingIdentities = [
        ...serverIdentities.map(identityId => {
            const baseIdentity = identities?.find(identity => identity.id === identityId) || { id: identityId };
            const updates = identityUpdates[identityId] || {};
            return { ...baseIdentity, ...updates };
        }),
        ...Object.keys(identityUpdates).filter(key => key.startsWith("new-")).map(key => ({ id: key, ...identityUpdates[key] })),
    ];

    const availableIdentities = identities?.filter(identity => !serverIdentities.includes(identity.id)) || [];

    const handleIdentityUpdate = (updatedIdentity) => {
        setIdentityUpdates(updates => ({ ...updates, [updatedIdentity.id]: updatedIdentity }));
    };

    const addNewIdentity = () => {
        const newId = `new-${Date.now()}`;
        setIdentityUpdates(updates => ({
            ...updates,
            [newId]: { name: "New Identity", username: "", authType: "password", password: "" },
        }));
        setMode("create");
    };

    const deleteIdentity = (identityId) => {
        if (typeof identityId === "string" && identityId.startsWith("new-")) {
            setIdentityUpdates(updates => {
                const newUpdates = { ...updates };
                delete newUpdates[identityId];
                return newUpdates;
            });
        } else {
            setIdentities(prev => prev.filter(id => id !== identityId));
            setIdentityUpdates(updates => {
                const newUpdates = { ...updates };
                delete newUpdates[identityId];
                return newUpdates;
            });
        }
    };

    const linkIdentity = (identityId) => {
        setIdentities(prev => [...prev, identityId]);
    };

    return (
        <div className="identities">
            <div className="identities-header">
                <h3>Identities</h3>
                <div className="identity-actions">
                    <Button text="New" icon={mdiPlus} onClick={addNewIdentity} />
                </div>
            </div>

            <div className="identities-list">
                {workingIdentities.map((identity) => (
                    <Identity key={identity.id} identity={identity} onUpdate={handleIdentityUpdate}
                              onDelete={deleteIdentity} />
                ))}

                {availableIdentities.length > 0 && (
                    <div className="available-identities-section">
                        <div className="available-identities-header">
                            <h4>Available to Link</h4>
                            <span className="available-count">{availableIdentities.length}</span>
                        </div>
                        <div className="available-identities-list">
                            {availableIdentities.map((identity) => (
                                <div key={identity.id} className="available-identity" onClick={() => linkIdentity(identity.id)}>
                                    <div className="available-identity-info">
                                        <div className="available-identity-name">
                                            <Icon path={mdiLink} size={0.7} />
                                            {identity.name}
                                        </div>
                                        <div className="available-identity-username">{identity.username || "No username"}</div>
                                    </div>
                                    <div className="available-identity-type">{(identity.authType || identity.type) === "ssh" ? "SSH Key" : "Password"}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {workingIdentities.length === 0 && availableIdentities.length === 0 && (
                <div className="no-identities">
                    <p>No identities configured.<br />Create a new identity or link an existing one.</p>
                </div>
            )}
        </div>
    );
};

export default IdentityPage;