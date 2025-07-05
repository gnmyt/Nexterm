import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
    mdiPlus,
    mdiTrashCan,
    mdiCheck,
    mdiLinkOff,
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
    const [identityPassword, setIdentityPassword] = useState(
        isNew ? "" : (identity.password !== undefined ? identity.password : "********"));
    const [identityKeyfile, setIdentityKeyfile] = useState(identity.sshKey || null);
    const [identityPassphrase, setIdentityPassphrase] = useState(
        isNew ? "" : (identity.passphrase !== undefined ? identity.passphrase : "********"));

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
                    ? { password: identityPassword === "********" ? undefined : identityPassword }
                    : {
                        sshKey: identityKeyfile,
                        passphrase: identityPassphrase === "********" ? undefined : identityPassphrase,
                    }
            ),
        };
        onUpdate(updatedIdentity);
    }, [identityName, identityUsername, authType, identityPassword, identityKeyfile, identityPassphrase, identity.id]);

    return (
        <div className="identity">
            <div className="identity-header">
                <Input icon={mdiAccountCircleOutline} value={identityName} setValue={setIdentityName}
                       placeholder="Identity Name" />
                <button className="unlink-identity-btn" onClick={() => onDelete(identity.id)}
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
    const [selectedIdentityToLink, setSelectedIdentityToLink] = useState("");

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

    const linkExistingIdentity = () => {
        if (selectedIdentityToLink) {
            const identityId = parseInt(selectedIdentityToLink);
            setIdentities(prev => [...prev, identityId]);
            setSelectedIdentityToLink("");
        }
    };

    return (
        <div className="identities">
            <div className="identities-header">
                <h3>Server Identities</h3>
                <div className="identity-actions">
                    <Button text="Add New Identity" icon={mdiPlus} onClick={addNewIdentity}
                            className="add-identity-btn" />
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
                                               label: `${identity.name} (${identity.username || "No username"})`,
                                               value: identity.id.toString(),
                                           })),
                                       ]}
                            />
                        </div>
                        <Button text="Link" onClick={linkExistingIdentity} disabled={!selectedIdentityToLink}
                                className="link-identity-btn" />
                    </div>
                </div>
            )}

            {workingIdentities.map((identity) => (
                <Identity key={identity.id} identity={identity} onUpdate={handleIdentityUpdate}
                          onDelete={deleteIdentity} />
            ))}

            {workingIdentities.length === 0 && (
                <div className="no-identities">
                    <p>No identities configured. Add a new identity or link an existing one.</p>
                </div>
            )}
        </div>
    );
};

export default IdentityPage;