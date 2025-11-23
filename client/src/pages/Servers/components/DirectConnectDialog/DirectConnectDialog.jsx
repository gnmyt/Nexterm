import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useEffect, useState, useCallback } from "react";
import Button from "@/common/components/Button";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
    mdiCheck,
} from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import Icon from "@mdi/react";

export const DirectConnectDialog = ({ open, onClose, onConnect }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const [username, setUsername] = useState("");
    const [authType, setAuthType] = useState("password");
    const [password, setPassword] = useState("");
    const [sshKey, setSshKey] = useState(null);
    const [passphrase, setPassphrase] = useState("");

    const readFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            setSshKey(e.target.result);
        };
        reader.readAsText(file);
    };

    const validateFields = () => {
        if (!username) {
            sendToast("Error", "Username is required");
            return false;
        }

        if (authType === "password" && !password) {
            sendToast("Error", "Password is required");
            return false;
        }

        if (authType === "ssh" && !sshKey) {
            sendToast("Error", "SSH key is required");
            return false;
        }

        return true;
    };

    const handleConnect = useCallback(() => {
        if (!validateFields()) return;

        const directIdentity = {
            username,
            type: authType,
            ...(authType === "password"
                ? { password }
                : { sshKey, passphrase: passphrase || undefined }
            ),
        };

        onConnect(directIdentity);
        onClose();
    }, [username, authType, password, sshKey, passphrase, onConnect, onClose]);

    useEffect(() => {
        if (!open) return;

        setUsername("");
        setAuthType("password");
        setPassword("");
        setSshKey(null);
        setPassphrase("");
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const submitOnEnter = (event) => {
            if (event.key === "Enter") {
                handleConnect();
            }
        };

        document.addEventListener("keydown", submitOnEnter);

        return () => {
            document.removeEventListener("keydown", submitOnEnter);
        };
    }, [open, handleConnect]);

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="direct-connect-dialog">
                <div className="direct-connect-header">
                    <h2>{t("servers.contextMenu.quickConnect")}</h2>
                </div>

                <div className="direct-connect-content">
                    <div className="identity-section">
                        <div className="name-row">
                            <div className="form-group">
                                <label htmlFor="username">{t("servers.dialog.fields.username")}</label>
                                <Input
                                    icon={mdiAccountCircleOutline}
                                    type="text"
                                    placeholder={t("servers.dialog.placeholders.username")}
                                    autoComplete="off"
                                    value={username}
                                    setValue={setUsername}
                                />
                            </div>

                            <div className="form-group">
                                <label>Authentication</label>
                                <SelectBox
                                    options={[
                                        { label: "Password", value: "password" },
                                        { label: "SSH Key", value: "ssh" }
                                    ]}
                                    selected={authType}
                                    setSelected={setAuthType}
                                />
                            </div>
                        </div>

                        {authType === "password" && (
                            <div className="form-group">
                                <label htmlFor="password">{t("servers.dialog.fields.password")}</label>
                                <Input
                                    icon={mdiLockOutline}
                                    type="password"
                                    placeholder={t("servers.dialog.placeholders.password")}
                                    autoComplete="off"
                                    value={password}
                                    setValue={setPassword}
                                />
                            </div>
                        )}

                        {authType === "ssh" && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="keyfile">SSH Private Key</label>
                                    <Input
                                        icon={mdiFileUploadOutline}
                                        type="file"
                                        autoComplete="off"
                                        onChange={readFile}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">Passphrase (optional)</label>
                                    <Input
                                        icon={mdiLockOutline}
                                        type="password"
                                        placeholder="Passphrase"
                                        autoComplete="off"
                                        value={passphrase}
                                        setValue={setPassphrase}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <Button
                    className="direct-connect-button"
                    onClick={handleConnect}
                    text={t("servers.contextMenu.connect")}
                />
            </div>
        </DialogProvider>
    );
};
