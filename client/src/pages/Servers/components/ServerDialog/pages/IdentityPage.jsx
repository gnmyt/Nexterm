import { mdiAccountCircleOutline, mdiFileUploadOutline, mdiLockOutline } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";

const Identity = ({ newIdentity, type, name, username, onUpdate }) => {

    const [identityName, setIdentityName] = useState(name || (newIdentity ? "Auto-generated identity" : ""));
    const [identityUsername, setIdentityUsername] = useState(username || "");
    const [authType, setAuthType] = useState(type || "password");
    const [identityPassword, setIdentityPassword] = useState(newIdentity ? "" : "********");
    const [identityKeyfile, setIdentityKeyfile] = useState(null);
    const [identityPassphrase, setIdentityPassphrase] = useState(newIdentity ? "" : "********");

    const readFile = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            setIdentityKeyfile(e.target.result);
        };
        reader.readAsText(file);
    }

    useEffect(() => {
        if (authType === "password") {
            onUpdate({ name: identityName, username: identityUsername, authType, password: identityPassword === "********"
                    ? undefined : identityPassword });
        } else {
            onUpdate({ name: identityName, username: identityUsername, authType, sshKey: identityKeyfile,
                passphrase: identityPassphrase === "********" ? undefined : identityPassphrase });
        }
    }, [identityName, identityUsername, authType, identityPassword, identityKeyfile, identityPassphrase]);

    return (
        <div className="identity">
            <div className="identity-header">
                <h3>{identityName}</h3>
            </div>
            <div className="name-row">
                <div className="form-group">
                    <label htmlFor="name">Username</label>
                    <Input icon={mdiAccountCircleOutline} type="text" placeholder="Username" id="name"
                           autoComplete="off" value={identityUsername} setValue={setIdentityUsername} />
                </div>

                <div className="form-group">
                    <label>Authentication</label>
                    <SelectBox options={[{ label: "Password", value: "password" }, { label: "Keyfile", value: "ssh" }]}
                               selected={authType} setSelected={setAuthType} />
                </div>
            </div>

            {authType === "password" && (
                <div className="password-row">
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <Input icon={mdiAccountCircleOutline} type="password" placeholder="Password" id="password"
                                 autoComplete="off" value={identityPassword} setValue={setIdentityPassword} />
                    </div>
                </div>
            )}

            {authType === "ssh" && (
                <div className="keyfile-row">
                    <div className="form-group">
                        <label htmlFor="keyfile">Keyfile</label>
                        <Input icon={mdiFileUploadOutline} type="file" id="keyfile" autoComplete="off"
                               onChange={readFile} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="passphrase">Passphrase</label>
                        <Input icon={mdiLockOutline} type="password" placeholder="Passphrase" id="passphrase"
                               autoComplete="off" value={identityPassphrase} setValue={setIdentityPassphrase} />
                    </div>
                </div>
            )}
        </div>
    );
};

const IdentityPage = ({ serverIdentities, setIdentityUpdates, identityUpdates }) => {

    const { identities } = useContext(IdentityContext);

    const mappedIdentities = serverIdentities.map((identityId) => {
        return identities.find((identity) => identity.id === identityId);
    });

    return (
        <div className="identities">
            {mappedIdentities.map((identity) => (
                <Identity key={identity.id} {...identity}
                            onUpdate={(updatedIdentity) => setIdentityUpdates(updates => ({ ...updates, [identity.id]: updatedIdentity }))} />
            ))}
            {mappedIdentities.length === 0 && <Identity newIdentity onUpdate={(updatedIdentity) =>
                setIdentityUpdates(updates => ({ ...updates, new: updatedIdentity }))}
                {...identityUpdates.new} />}
        </div>
    );
};

export default IdentityPage;