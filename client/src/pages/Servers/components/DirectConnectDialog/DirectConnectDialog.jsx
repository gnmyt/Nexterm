import { DialogProvider } from "@/common/components/Dialog";
import "./styles.sass";
import { useEffect, useState, useCallback, useMemo } from "react";
import Button from "@/common/components/Button";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
} from "@mdi/js";
import Input from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import { getFieldConfig } from "@/pages/Servers/components/ServerDialog/utils/fieldConfig.js";

export const DirectConnectDialog = ({ open, onClose, onConnect, server }) => {
    const { t } = useTranslation();
    const { sendToast } = useToast();

    const protocol = server?.config?.protocol;
    const fieldConfig = useMemo(() => getFieldConfig("server", protocol), [protocol]);
    const allowedAuthTypes = fieldConfig.allowedAuthTypes || ["password", "ssh", "both"];
    const defaultAuthType = allowedAuthTypes[0] || "password";

    const [username, setUsername] = useState("");
    const [authType, setAuthType] = useState(defaultAuthType);
    const [password, setPassword] = useState("");
    const [sshKey, setSshKey] = useState(null);
    const [passphrase, setPassphrase] = useState("");

    const allAuthOptions = [
        { label: t("servers.dialog.identities.passwordOnly"), value: "password-only" },
        { label: t("servers.dialog.identities.userPassword"), value: "password" },
        { label: t("servers.dialog.identities.sshKey"), value: "ssh" },
        { label: t("servers.dialog.identities.both"), value: "both" },
    ];
    
    const authOptions = useMemo(() => 
        allAuthOptions.filter(opt => allowedAuthTypes.includes(opt.value)),
        [allowedAuthTypes, t]
    );

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
        if (authType !== "password-only" && !username) {
            sendToast("Error", t("servers.messages.usernameRequired") || "Username is required");
            return false;
        }

        if ((authType === "password" || authType === "password-only" || authType === "both") && !password) {
            sendToast("Error", t("servers.messages.passwordRequired") || "Password is required");
            return false;
        }

        if ((authType === "ssh" || authType === "both") && !sshKey) {
            sendToast("Error", t("servers.messages.sshKeyRequired") || "SSH key is required");
            return false;
        }

        return true;
    };

    const handleConnect = useCallback(() => {
        if (!validateFields()) return;

        const directIdentity = {
            username: authType === "password-only" ? undefined : username,
            type: authType,
            ...(authType === "password" || authType === "password-only"
                ? { password }
                : authType === "both"
                ? { password, sshKey, passphrase: passphrase || undefined }
                : { sshKey, passphrase: passphrase || undefined }
            ),
        };

        onConnect(directIdentity);
        onClose();
    }, [username, authType, password, sshKey, passphrase, onConnect, onClose]);

    useEffect(() => {
        if (!open) return;

        setUsername("");
        setAuthType(defaultAuthType);
        setPassword("");
        setSshKey(null);
        setPassphrase("");
    }, [open, defaultAuthType]);

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

    const showUsername = authType !== "password-only";

    return (
        <DialogProvider open={open} onClose={onClose}>
            <div className="direct-connect-dialog">
                <div className="direct-connect-header">
                    <h2>{t("servers.contextMenu.quickConnect")}</h2>
                </div>

                <div className="direct-connect-content">
                    <div className="identity-section">
                        <div className={`name-row ${!showUsername ? 'single-column' : ''}`}>
                            {showUsername && (
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
                            )}

                            <div className="form-group">
                                <label>{t("servers.dialog.identities.authentication")}</label>
                                <SelectBox
                                    options={authOptions}
                                    selected={authType}
                                    setSelected={setAuthType}
                                />
                            </div>
                        </div>

                        {(authType === "password" || authType === "password-only" || authType === "both") && (
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

                        {(authType === "ssh" || authType === "both") && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="keyfile">{t("servers.dialog.identities.sshPrivateKey")}</label>
                                    <Input
                                        icon={mdiFileUploadOutline}
                                        type="file"
                                        autoComplete="off"
                                        onChange={readFile}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">{t("servers.dialog.identities.passphrase")}</label>
                                    <Input
                                        icon={mdiLockOutline}
                                        type="password"
                                        placeholder={t("servers.dialog.identities.passphrase")}
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
