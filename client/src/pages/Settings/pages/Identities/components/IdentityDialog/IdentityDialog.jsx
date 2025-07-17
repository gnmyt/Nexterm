import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
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
            sendToast("Error", t('settings.identities.dialog.messages.nameRequired'));
            return;
        }

        if (authType === "password" && !password && !isEditing) {
            sendToast("Error", t('settings.identities.dialog.messages.passwordRequired'));
            return;
        }

        if (authType === "ssh" && !sshKey && !isEditing) {
            sendToast("Error", t('settings.identities.dialog.messages.sshKeyRequired'));
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
                sendToast("Success", t('settings.identities.dialog.messages.updateSuccess'));
            } else {
                await putRequest("identities", identityData);
                sendToast("Success", t('settings.identities.dialog.messages.createSuccess'));
            }

            onClose();
        } catch (error) {
            sendToast("Error", error.message || t(`settings.identities.dialog.messages.${isEditing ? 'updateFailed' : 'createFailed'}`));
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
                    <h2>{isEditing ? t('settings.identities.dialog.editTitle') : t('settings.identities.dialog.createTitle')}</h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="dialog-content">
                        <div className="form-group">
                            <label htmlFor="name">{t('settings.identities.dialog.fields.name')}</label>
                            <IconInput icon={mdiAccountCircleOutline} value={name} setValue={setName}
                                       placeholder={t('settings.identities.dialog.fields.namePlaceholder')} id="name" required />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="username">{t('settings.identities.dialog.fields.username')}</label>
                                <IconInput icon={mdiAccountCircleOutline} value={username} setValue={setUsername}
                                           placeholder={t('settings.identities.dialog.fields.usernamePlaceholder')} id="username" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="authType">{t('settings.identities.dialog.fields.authType')}</label>
                                <SelectBox selected={authType} setSelected={setAuthType}
                                           options={[
                                               { label: t('settings.identities.dialog.authTypes.password'), value: "password" },
                                               { label: t('settings.identities.dialog.authTypes.ssh'), value: "ssh" },
                                           ]} />
                            </div>
                        </div>

                        {authType === "password" && (
                            <div className="form-group">
                                <label htmlFor="password">{t('settings.identities.dialog.fields.password')}</label>
                                <IconInput icon={mdiLockOutline} type="password" value={password} setValue={setPassword}
                                           placeholder={isEditing ? t('settings.identities.dialog.fields.passwordPlaceholderEdit') : t('settings.identities.dialog.fields.passwordPlaceholder')}
                                           id="password" required={!isEditing} />
                            </div>
                        )}

                        {authType === "ssh" && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="sshKey">{t('settings.identities.dialog.fields.sshKey')}</label>
                                    <IconInput icon={mdiFileUploadOutline} type="file" onChange={readFile} id="sshKey"
                                               required={!isEditing} />
                                    {sshKey && (
                                        <div className="keyfile-status">
                                            <Icon path={mdiCheck} />
                                            <span>{t('settings.identities.dialog.keyFileLoaded')}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">{t('settings.identities.dialog.fields.passphrase')}</label>
                                    <IconInput icon={mdiLockOutline} type="password" value={passphrase}
                                               setValue={setPassphrase}
                                               placeholder={isEditing ? t('settings.identities.dialog.fields.passphrasePlaceholderEdit') : t('settings.identities.dialog.fields.passphrasePlaceholder')}
                                               id="passphrase" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('settings.identities.dialog.actions.cancel')} onClick={handleClose} type="secondary" />
                        <Button text={isEditing ? t('settings.identities.dialog.actions.update') : t('settings.identities.dialog.actions.create')} type="submit"
                                disabled={isLoading} />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};
