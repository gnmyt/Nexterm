import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { mdiAccountCircleOutline, mdiAccountEdit, mdiCameraOutline, mdiClose, mdiShieldCheck, mdiLockReset, mdiTranslate, mdiSync, mdiCloudSync, mdiCloudOffOutline, mdiWeb, mdiTabUnselected, mdiFingerprint, mdiKeyVariant, mdiPencil, mdiTrashCan, mdiPlus, mdiApi } from "@mdi/js";
import { useContext, useEffect, useRef, useState } from "react";
import LetterAvatar from "@/common/components/LetterAvatar";
import { createSquareAvatar, MAX_AVATAR_INPUT_SIZE } from "@/common/utils/imageUtils.js";
import { uploadFile } from "@/common/utils/RequestUtil.js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import Button from "@/common/components/Button";
import { patchRequest, postRequest, getRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import TwoFactorAuthentication from "@/pages/Settings/pages/Account/dialogs/TwoFactorAuthentication";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import AddPasskeyDialog from "@/pages/Settings/pages/Account/dialogs/AddPasskeyDialog";
import AddApiKeyDialog from "@/pages/Settings/pages/Account/dialogs/AddApiKeyDialog";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { startRegistration } from "@simplewebauthn/browser";
import { useTranslation } from "react-i18next";
import SelectBox from "@/common/components/SelectBox";
import { languages } from "@/i18n.js";
import i18n from "@/i18n.js";
import Icon from "@mdi/react";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";

export const Account = () => {
    const { t } = useTranslation();
    const [twoFactorOpen, setTwoFactorOpen] = useState(false);
    const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
    const [addPasskeyOpen, setAddPasskeyOpen] = useState(false);
    const [deletePasskeyOpen, setDeletePasskeyOpen] = useState(false);
    const [passkeyToDelete, setPasskeyToDelete] = useState(null);
    const [passkeys, setPasskeys] = useState([]);
    const [editingPasskeyId, setEditingPasskeyId] = useState(null);
    const [editingPasskeyName, setEditingPasskeyName] = useState("");
    const [addApiKeyOpen, setAddApiKeyOpen] = useState(false);
    const [apiKeys, setApiKeys] = useState([]);
    const [deleteApiKeyOpen, setDeleteApiKeyOpen] = useState(false);
    const [apiKeyToDelete, setApiKeyToDelete] = useState(null);

    const { user, login, sessionToken } = useContext(UserContext);
    const { isGroupSynced, toggleGroupSync, language, setLanguage } = usePreferences();
    const { sendToast } = useToast();

    const [updatedField, setUpdatedField] = useState(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarInputRef = useRef(null);

    const uploadAvatar = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (file.size > MAX_AVATAR_INPUT_SIZE)
            return sendToast("Error", t("settings.account.avatar.tooLarge"));

        setAvatarUploading(true);
        try {
            const avatar = await createSquareAvatar(file);
            await uploadFile("/api/accounts/me/avatar", avatar, {
                headers: { "Authorization": `Bearer ${sessionToken}` },
            });
            await login();
            sendToast("Success", t("settings.account.avatar.updated"));
        } catch (error) {
            sendToast("Error", error.message || t("settings.account.avatar.uploadFailed"));
        } finally {
            setAvatarUploading(false);
        }
    };

    const removeAvatar = async () => {
        try {
            await deleteRequest("accounts/me/avatar");
            await login();
            sendToast("Success", t("settings.account.avatar.removed"));
        } catch (error) {
            sendToast("Error", error.message || t("settings.account.avatar.removeFailed"));
        }
    };

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [sessionSync, setSessionSync] = useState("same_browser");
    const currentLanguage = language || i18n.language || "en";

    const languageOptions = languages.map(lang => ({ label: lang.name, value: lang.code }));

    const sessionSyncOptions = [
        { label: t("settings.account.sessionSyncAcrossDevices"), value: "across_devices", icon: mdiCloudSync },
        { label: t("settings.account.sessionSyncSameBrowser"), value: "same_browser", icon: mdiWeb },
        { label: t("settings.account.sessionSyncSameTab"), value: "same_tab", icon: mdiTabUnselected }
    ];

    const changeLanguage = (languageCode) => setLanguage(languageCode);

    const changeSessionSync = (mode) => {
        setSessionSync(mode);
        patchRequest("accounts/session-sync", { sessionSync: mode })
            .then(() => {
                login();
            })
            .catch(err => console.error(err));
    };

    const updateName = (config) => {
        if (config.firstName && config.firstName === user.firstName) return;
        if (config.lastName && config.lastName === user.lastName) return;

        patchRequest(`accounts/name`, config)
            .then(() => {
                login();
                setUpdatedField(Object.keys(config)[0]);

                setTimeout(() => {
                    setUpdatedField(null);
                }, 1500);
            })
            .catch(err => console.error(err));
    };

    const disable2FA = () => {
        postRequest("accounts/totp/disable").then(() => {
            login();
        }).catch(err => console.error(err));
    }

    const loadPasskeys = async () => {
        try {
            const result = await getRequest("accounts/passkeys");
            setPasskeys(result);
        } catch (err) {
            console.error("Failed to load passkeys:", err);
        }
    };

    const addPasskey = async (name) => {
        setAddPasskeyOpen(false);
        try {
            const origin = window.location.origin;
            const optionsRes = await postRequest("accounts/passkeys/register/options", { origin });
            
            const attestationResponse = await startRegistration({ optionsJSON: optionsRes });
            
            await postRequest("accounts/passkeys/register/verify", {
                response: attestationResponse,
                name,
                origin,
            });
            
            loadPasskeys();
        } catch (err) {
            if (err.name === "NotAllowedError") {
                return;
            }
            console.error("Failed to register passkey:", err);
            sendToast("Error", t("settings.account.passkeys.registerError"));
        }
    };

    const confirmDeletePasskey = (passkey) => {
        setPasskeyToDelete(passkey);
        setDeletePasskeyOpen(true);
    };

    const deletePasskey = async () => {
        if (!passkeyToDelete) return;
        
        try {
            await deleteRequest(`accounts/passkeys/${passkeyToDelete.id}`);
            loadPasskeys();
        } catch (err) {
            console.error("Failed to delete passkey:", err);
        }
        setPasskeyToDelete(null);
    };

    const startEditPasskey = (passkey) => {
        setEditingPasskeyId(passkey.id);
        setEditingPasskeyName(passkey.name);
    };

    const savePasskeyName = async () => {
        if (!editingPasskeyName.trim()) return;
        
        try {
            await patchRequest(`accounts/passkeys/${editingPasskeyId}`, { name: editingPasskeyName });
            setEditingPasskeyId(null);
            loadPasskeys();
        } catch (err) {
            console.error("Failed to rename passkey:", err);
        }
    };

    const cancelEditPasskey = () => {
        setEditingPasskeyId(null);
        setEditingPasskeyName("");
    };

    const loadApiKeys = async () => {
        try {
            const result = await getRequest("accounts/api-keys");
            setApiKeys(result);
        } catch (err) {
            console.error("Failed to load API keys:", err);
        }
    };

    const confirmDeleteApiKey = (apiKey) => {
        setApiKeyToDelete(apiKey);
        setDeleteApiKeyOpen(true);
    };

    const deleteApiKey = async () => {
        if (!apiKeyToDelete) return;
        try {
            await deleteRequest(`accounts/api-keys/${apiKeyToDelete.id}`);
            loadApiKeys();
        } catch (err) {
            console.error("Failed to delete API key:", err);
        }
        setApiKeyToDelete(null);
    };

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName);
            setLastName(user.lastName);
            setSessionSync(user.sessionSync || "same_browser");
            loadPasskeys();
            loadApiKeys();
        }
    }, [user]);

    return (
        <div className="account-page">
            <TwoFactorAuthentication open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />
            <PasswordChange open={passwordChangeOpen} onClose={() => setPasswordChangeOpen(false)} />
            <AddPasskeyDialog 
                open={addPasskeyOpen} 
                onClose={() => setAddPasskeyOpen(false)} 
                onSubmit={addPasskey} 
            />
            <ActionConfirmDialog
                open={deletePasskeyOpen}
                setOpen={setDeletePasskeyOpen}
                onConfirm={deletePasskey}
                text={t("settings.account.passkeys.confirmDelete")}
            />
            <AddApiKeyDialog
                open={addApiKeyOpen}
                onClose={() => setAddApiKeyOpen(false)}
                onCreated={loadApiKeys}
            />
            <ActionConfirmDialog
                open={deleteApiKeyOpen}
                setOpen={setDeleteApiKeyOpen}
                onConfirm={deleteApiKey}
                text={t("settings.account.apiKeys.confirmDelete")}
            />
            <div className="account-section">
                <h2><Icon path={mdiAccountEdit} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.accountDetails")}</h2>
                <div className="section-inner">
                    <div className="form-group avatar-group">
                        <label htmlFor="avatar">{t("settings.account.avatar.label")}</label>
                        <div className="avatar-edit">
                            <button type="button" id="avatar" className="avatar-button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={avatarUploading} title={t("settings.account.avatar.upload")}>
                                <LetterAvatar user={user} size="lg" showTooltip={false} />
                                <span className="avatar-overlay"><Icon path={mdiCameraOutline} size={0.9} /></span>
                            </button>
                            {user?.avatarHash && <button type="button" className="avatar-remove" onClick={removeAvatar}
                                                         disabled={avatarUploading}
                                                         title={t("settings.account.avatar.remove")}>
                                <Icon path={mdiClose} size={0.6} />
                            </button>}
                            <input type="file" ref={avatarInputRef} accept="image/png,image/jpeg,image/webp,image/gif"
                                   style={{ display: "none" }} onChange={uploadAvatar} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="firstName">{t("settings.account.firstName")}</label>
                        <IconInput icon={mdiAccountCircleOutline} placeholder={t("settings.account.firstName")}
                                   id="firstName" customClass={updatedField === "firstName" ? " fd-updated" : ""}
                                   value={firstName} setValue={setFirstName}
                                   onBlur={(event) => updateName({ firstName: event.target.value })} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="lastName">{t("settings.account.lastName")}</label>
                        <IconInput icon={mdiAccountCircleOutline} placeholder={t("settings.account.lastName")}
                                   id="lastName"
                                   value={lastName} setValue={setLastName}
                                   customClass={updatedField === "lastName" ? " fd-updated" : ""}
                                   onBlur={(event) => updateName({ lastName: event.target.value })} />
                    </div>
                </div>
            </div>

            <div className="account-section">
                <div className="tfa-title">
                    <h2><Icon path={mdiShieldCheck} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.twoFactor")}</h2>
                    {user?.totpEnabled ? <p className="active">{t("settings.account.twoFactorActive")}</p> :
                        <p className="inactive">{t("settings.account.twoFactorInactive")}</p>}
                </div>
                <div className="section-inner">
                    <p style={{ maxWidth: "25rem" }}>{t("settings.account.twoFactorDescription")}</p>
                    {!user?.totpEnabled &&
                        <Button text={t("settings.account.enable2FA")} onClick={() => setTwoFactorOpen(true)} />}
                    {user?.totpEnabled ? <Button text={t("settings.account.disable2FA")} onClick={disable2FA} /> : null}
                </div>
            </div>

            <div className="account-section">
                <h2><Icon path={mdiLockReset} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.changePassword")}</h2>
                <div className="section-inner">
                    <p style={{ maxWidth: "25rem" }}>{t("settings.account.changePasswordDescription")}</p>

                    <Button text={t("settings.account.changePasswordButton")}
                            onClick={() => setPasswordChangeOpen(true)} />
                </div>
            </div>

            <div className="account-section">
                <div className="section-header">
                    <h2><Icon path={mdiTranslate} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.language")}</h2>
                    <Button
                        icon={isGroupSynced("general") ? mdiCloudSync : mdiCloudOffOutline}
                        onClick={() => {
                            if (!user) {
                                sendToast(t("common.error"), t("settings.account.syncLoginRequired"));
                                return;
                            }
                            const wasSynced = isGroupSynced("general");
                            toggleGroupSync("general");
                            sendToast(
                                t("common.success"), 
                                wasSynced ? t("settings.account.generalSyncDisabled") : t("settings.account.generalSyncEnabled")
                            );
                        }}
                        type={isGroupSynced("general") ? "primary" : undefined}
                    />
                </div>
                <div className="section-inner">
                    <div className="language-help">
                        <p className="main-description">{t("settings.account.languageDescription")}</p>
                        <p className="translate-help">
                            {t("settings.account.missingLanguage")}
                            <span onClick={() => openExternalUrl("https://crowdin.com/project/nexterm")}
                               className="translate-link">
                                {t("settings.account.helpTranslateLink")}
                            </span>
                        </p>
                    </div>
                    <SelectBox options={languageOptions} selected={currentLanguage} setSelected={changeLanguage} />
                </div>
            </div>

            <div className="account-section">
                <h2><Icon path={mdiSync} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.sessionSynchronization")}</h2>
                <div className="section-inner">
                    <p style={{ maxWidth: "25rem" }}>
                        {sessionSync === "across_devices" && t("settings.account.sessionSyncAcrossDevicesDesc")}
                        {sessionSync === "same_browser" && t("settings.account.sessionSyncSameBrowserDesc")}
                        {sessionSync === "same_tab" && t("settings.account.sessionSyncSameTabDesc")}
                    </p>
                    <SelectBox options={sessionSyncOptions} selected={sessionSync} setSelected={changeSessionSync} />
                </div>
            </div>

            <div className="account-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2><Icon path={mdiFingerprint} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.passkeys.sectionTitle")}</h2>
                        <p>{t("settings.account.passkeys.sectionDescription")}</p>
                    </div>
                    <Button text={t("settings.account.passkeys.addButton")} icon={mdiPlus} onClick={() => setAddPasskeyOpen(true)} />
                </div>
                <div className="settings-list">
                    {passkeys.length > 0 ? (
                        passkeys.map(passkey => (
                            <div className="settings-list-item" key={passkey.id}>
                                <div className="item-info">
                                    <Icon path={mdiKeyVariant} className="item-icon" />
                                    <div className="item-details">
                                        {editingPasskeyId === passkey.id ? (
                                            <input 
                                                type="text" 
                                                value={editingPasskeyName} 
                                                onChange={(e) => setEditingPasskeyName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") savePasskeyName();
                                                    if (e.key === "Escape") cancelEditPasskey();
                                                }}
                                                onBlur={savePasskeyName}
                                                autoFocus
                                                className="passkey-name-input"
                                            />
                                        ) : (
                                            <h3>{passkey.name}</h3>
                                        )}
                                        <p className="item-meta">
                                            {t("settings.account.passkeys.createdAt", {
                                                date: new Date(passkey.createdAt).toLocaleDateString(),
                                                interpolation: { escapeValue: false }
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="item-actions">
                                    <button className="action-btn edit-btn" onClick={() => startEditPasskey(passkey)} title={t("settings.account.passkeys.rename")}>
                                        <Icon path={mdiPencil} size={0.8} />
                                    </button>
                                    <button className="action-btn delete-btn" onClick={() => confirmDeletePasskey(passkey)} title={t("settings.account.passkeys.delete")}>
                                        <Icon path={mdiTrashCan} size={0.8} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="list-empty">
                            <p>{t("settings.account.passkeys.noPasskeys")}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="account-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2><Icon path={mdiApi} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.apiKeys.sectionTitle")}</h2>
                        <p>{t("settings.account.apiKeys.sectionDescription")}</p>
                    </div>
                    <Button text={t("settings.account.apiKeys.addButton")} icon={mdiPlus} onClick={() => setAddApiKeyOpen(true)} />
                </div>
                <div className="settings-list">
                    {apiKeys.length > 0 ? (
                        apiKeys.map(apiKey => (
                            <div className="settings-list-item" key={apiKey.id}>
                                <div className="item-info">
                                    <Icon path={mdiKeyVariant} className="item-icon" />
                                    <div className="item-details">
                                        <h3>{apiKey.name}</h3>
                                        <p className="item-meta api-key-meta">
                                            <code>{apiKey.prefix}</code>
                                            <span>
                                                {apiKey.lastUsedAt
                                                    ? t("settings.account.apiKeys.lastUsed", { date: new Date(apiKey.lastUsedAt).toLocaleDateString(), interpolation: { escapeValue: false } })
                                                    : t("settings.account.apiKeys.neverUsed")}
                                            </span>
                                            {apiKey.expiresAt && (
                                                <span>{t("settings.account.apiKeys.expires", { date: new Date(apiKey.expiresAt).toLocaleDateString(), interpolation: { escapeValue: false } })}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="item-actions">
                                    <button className="action-btn delete-btn" onClick={() => confirmDeleteApiKey(apiKey)} title={t("settings.account.apiKeys.delete")}>
                                        <Icon path={mdiTrashCan} size={0.8} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="list-empty">
                            <p>{t("settings.account.apiKeys.noKeys")}</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};