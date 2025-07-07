import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect } from "react";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
    mdiCheck,
    mdiKey,
} from "@mdi/js";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import "./styles.sass";

export const IdentityDialog = ({ open, onClose, identity }) => {
    const { sendToast } = useToast();
    const isEditing = !!identity;

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [authType, setAuthType] = useState("password");
    const [password, setPassword] = useState("");
    const [sshKey, setSshKey] = useState(null);
    const [passphrase, setPassphrase] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) {
            if (isEditing) {
                setName(identity.name || "");
                setUsername(identity.username || "");
                setAuthType(identity.type || "password");
                setPassword("********");
                setSshKey(identity.sshKey || null);
                setPassphrase("********");
            } else {
                resetForm();
            }
        }
    }, [open, identity, isEditing]);

    const resetForm = () => {
        setName("");
        setUsername("");
        setAuthType("password");
        setPassword("");
        setSshKey(null);
        setPassphrase("");
    };

    const readFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setSshKey(e.target.result);
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            sendToast("Error", "Identity name is required");
            return;
        }

        if (authType === "password" && !password && !isEditing) {
            sendToast("Error", "Password is required");
            return;
        }

        if (authType === "ssh" && !sshKey && !isEditing) {
            sendToast("Error", "SSH key is required");
            return;
        }

        setIsLoading(true);

        try {
            const identityData = {
                name: name.trim(),
                username: username.trim() || undefined,
                type: authType,
                ...(authType === "password"
                        ? { password: password === "********" ? undefined : password }
                        : {
                            sshKey: sshKey || undefined,
                            ...(passphrase && passphrase !== "********" ? { passphrase } : {}),
                        }
                ),
            };

            if (isEditing) {
                await patchRequest(`identities/${identity.id}`, identityData);
                sendToast("Success", "Identity updated successfully");
            } else {
                await putRequest("identities", identityData);
                sendToast("Success", "Identity created successfully");
            }

            onClose();
        } catch (error) {
            sendToast("Error", error.message || `Failed to ${isEditing ? "update" : "create"} identity`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = (event) => {
        if (event) event.preventDefault();
        onClose();
    };

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="identity-dialog">
                <div className="dialog-title">
                    <Icon path={mdiKey} />
                    <h2>{isEditing ? "Edit Identity" : "Create New Identity"}</h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dialog-content">
                        <div className="form-group">
                            <label htmlFor="name">Identity Name</label>
                            <IconInput icon={mdiAccountCircleOutline} value={name} setValue={setName}
                                       placeholder="Enter identity name" id="name" required />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="username">Username</label>
                                <IconInput icon={mdiAccountCircleOutline} value={username} setValue={setUsername}
                                           placeholder="Username (optional)" id="username" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="authType">Authentication Type</label>
                                <SelectBox selected={authType} setSelected={setAuthType}
                                           options={[
                                               { label: "Password", value: "password" },
                                               { label: "SSH Key", value: "ssh" },
                                           ]} />
                            </div>
                        </div>

                        {authType === "password" && (
                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <IconInput icon={mdiLockOutline} type="password" value={password} setValue={setPassword}
                                           placeholder={isEditing ? "Leave blank to keep current password" : "Enter password"}
                                           id="password" required={!isEditing} />
                            </div>
                        )}

                        {authType === "ssh" && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="sshKey">SSH Private Key</label>
                                    <IconInput icon={mdiFileUploadOutline} type="file" onChange={readFile} id="sshKey"
                                               required={!isEditing} />
                                    {sshKey && (
                                        <div className="keyfile-status">
                                            <Icon path={mdiCheck} />
                                            <span>Key file loaded</span>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">Passphrase (optional)</label>
                                    <IconInput icon={mdiLockOutline} type="password" value={passphrase}
                                               setValue={setPassphrase}
                                               placeholder={isEditing ? "Leave blank to keep current passphrase" : "Enter passphrase (optional)"}
                                               id="passphrase" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="dialog-actions">
                        <Button text="Cancel" onClick={handleClose} type="secondary" />
                        <Button text={isEditing ? "Update Identity" : "Create Identity"} type="submit"
                                disabled={isLoading} />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};
