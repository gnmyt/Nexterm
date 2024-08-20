import { mdiAccountCircleOutline } from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { useContext, useEffect, useState } from "react";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";

const Identity = ({ newIdentity, name, username, onUpdate, password }) => {

    const [identityName, setIdentityName] = useState(name || (newIdentity ? "Auto-generated identity" : ""));
    const [identityUsername, setIdentityUsername] = useState(username || "");
    const [authType, setAuthType] = useState("password");
    const [identityPassword, setIdentityPassword] = useState(password || (newIdentity ? "" : "********"));

    useEffect(() => {
        if (authType === "password") {
            onUpdate({ name: identityName, username: identityUsername, authType, password: identityPassword === "********"
                    ? undefined : identityPassword });
        } else {
            onUpdate({ name: identityName, username: identityUsername, authType });
        }
    }, [identityName, identityUsername, authType, identityPassword]);

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