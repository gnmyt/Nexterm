import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { patchRequest, putRequest } from "@/common/utils/RequestUtil.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import {
    mdiAccountCircleOutline,
    mdiFileUploadOutline,
    mdiLockOutline,
    mdiKey,
} from "@mdi/js";
import Icon from "@mdi/react";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import SelectBox from "@/common/components/SelectBox";
import "./styles.sass";

export const IdentityDialog = ({ open, onClose, identity, organizationId }) => {
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
    
    const initialValues = useRef({ name: '', username: '', authType: 'password', password: '', sshKey: null, passphrase: '' });

    useEffect(() => {
        if (open) {
            if (isEditing) {
                setName(identity.name || "");
                setUsername(identity.username || "");
                setAuthType(identity.type || "password");
                setPassword("********");
                setSshKey(identity.sshKey || null);
                setPassphrase("********");
                initialValues.current = {
                    name: identity.name || '',
                    username: identity.username || '',
                    authType: identity.type || 'password',
                    password: '********',
                    sshKey: identity.sshKey || null,
                    passphrase: '********'
                };
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
        initialValues.current = { name: '', username: '', authType: 'password', password: '', sshKey: null, passphrase: '' };
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

        if ((authType === "password" || authType === "password-only" || authType === "both") && !password && !isEditing) {
            sendToast("Error", t('settings.identities.dialog.messages.passwordRequired'));
            return;
        }

        if ((authType === "ssh" || authType === "both") && !sshKey && !isEditing) {
            sendToast("Error", t('settings.identities.dialog.messages.sshKeyRequired'));
            return;
        }

        setIsLoading(true);

        try {
            const identityData = {
                name: name.trim(),
                username: authType === "password-only" ? undefined : (username.trim() || undefined),
                type: authType,
                // Handle Password
                ...((authType === "password" || authType === "password-only" || authType === "both")
                        ? { 
                            // Omit password if it's the placeholder or empty to prevent overwriting or validation errors
                            password: password === "********" ? undefined : (password || undefined) 
                        }
                        : {}
                ),
                // Handle SSH Key and Passphrase
                ...((authType === "ssh" || authType === "both")
                        ? {
                            sshKey: sshKey || undefined,
                            // Only include passphrase if it has a real value and isn't the placeholder
                            ...(passphrase && passphrase !== "********" ? { passphrase } : {})
                        }
                        : {}
                ),
            };

            if (isEditing) {
                await patchRequest(`identities/${identity.id}`, identityData);
                sendToast("Success", t('settings.identities.dialog.messages.updateSuccess'));
            } else {
                if (organizationId) {
                    identityData.organizationId = organizationId;
                }
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

    const isDirty = name !== initialValues.current.name || 
                     username !== initialValues.current.username || 
                     authType !== initialValues.current.authType ||
                     password !== initialValues.current.password || 
                     sshKey !== initialValues.current.sshKey || 
                     passphrase !== initialValues.current.passphrase;

    return (
        <DialogProvider open={open} onClose={onClose} isDirty={isDirty}>
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

                        <div className={`form-row ${authType === "password-only" ? 'single-column' : ''}`}>
                            {authType !== "password-only" && (
                                <div className="form-group">
                                    <label htmlFor="username">{t('settings.identities.dialog.fields.username')}</label>
                                    <IconInput icon={mdiAccountCircleOutline} value={username} setValue={setUsername}
                                               placeholder={t('settings.identities.dialog.fields.usernamePlaceholder')} id="username" />
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="authType">{t('settings.identities.dialog.fields.authType')}</label>
                                <SelectBox selected={authType} setSelected={setAuthType}
                                           options={[
                                               { label: t('settings.identities.dialog.authTypes.password-only'), value: "password-only" },
                                               { label: t('settings.identities.dialog.authTypes.password'), value: "password" },
                                               { label: t('settings.identities.dialog.authTypes.ssh'), value: "ssh" },
                                               { label: t('settings.identities.dialog.authTypes.both'), value: "both" },
                                           ]} />
                            </div>
                        </div>

                        {(authType === "password" || authType === "password-only" || authType === "both") && (
                            <div className="form-group">
                                <label htmlFor="password">{t('settings.identities.dialog.fields.password')}</label>
                                <IconInput icon={mdiLockOutline} type="password" value={password} setValue={setPassword}
                                           placeholder={isEditing ? t('settings.identities.dialog.fields.passwordPlaceholderEdit') : t('settings.identities.dialog.fields.passwordPlaceholder')}
                                           id="password" name="password" required={!isEditing && authType === "password"} autoComplete="new-password" />
                            </div>
                        )}

                        {(authType === "ssh" || authType === "both") && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="sshKey">{t('settings.identities.dialog.fields.sshKey')}</label>
                                    <IconInput icon={mdiFileUploadOutline} type="file" onChange={readFile} id="sshKey"
                                               required={!isEditing} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="passphrase">{t('settings.identities.dialog.fields.passphrase')}</label>
                                    <IconInput icon={mdiLockOutline} type="password" value={passphrase}
                                               setValue={setPassphrase}
                                               placeholder={isEditing ? t('settings.identities.dialog.fields.passphrasePlaceholderEdit') : t('settings.identities.dialog.fields.passphrasePlaceholder')}
                                               id="passphrase" name="passphrase" autoComplete="new-password" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="dialog-actions">
                        <Button text={t('settings.identities.dialog.actions.cancel')} onClick={handleClose} type="secondary" buttonType="button" />
                        <Button text={isEditing ? t('settings.identities.dialog.actions.update') : t('settings.identities.dialog.actions.create')} buttonType="submit"
                                disabled={isLoading} />
                    </div>
                </form>
            </div>
        </DialogProvider>
    );
};
