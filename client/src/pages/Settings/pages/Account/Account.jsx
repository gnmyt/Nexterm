import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { mdiAccountCircleOutline, mdiWhiteBalanceSunny, mdiAccountEdit, mdiPalette, mdiShieldCheck, mdiLockReset, mdiTranslate, mdiSync, mdiCloudSync, mdiCloudOffOutline, mdiWeb, mdiTabUnselected, mdiWeatherNight, mdiFingerprint, mdiKeyVariant, mdiPencil, mdiTrashCan, mdiPlus, mdiCheck } from "@mdi/js";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import Button from "@/common/components/Button";
import { patchRequest, postRequest, getRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import TwoFactorAuthentication from "@/pages/Settings/pages/Account/dialogs/TwoFactorAuthentication";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import AddPasskeyDialog from "@/pages/Settings/pages/Account/dialogs/AddPasskeyDialog";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { startRegistration } from "@simplewebauthn/browser";
import { useTranslation } from "react-i18next";
import SelectBox from "@/common/components/SelectBox";
import { languages } from "@/i18n.js";
import i18n from "@/i18n.js";
import Icon from "@mdi/react";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";
import Tooltip from "@/common/components/Tooltip";

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
    const [darkClickCount, setDarkClickCount] = useState(0);
    const darkClickTimeout = useRef(null);

    const { user, login } = useContext(UserContext);
    const { themeMode, setTheme, accentColor, setAccentColor, accentColors, uiScale, setUiScale, isGroupSynced, toggleGroupSync, language, setLanguage } = usePreferences();
    const { sendToast } = useToast();

    const [updatedField, setUpdatedField] = useState(null);

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

    const sizeOptions = [
        { label: t("settings.account.sizeXS"), value: 0.8 },
        { label: t("settings.account.sizeS"), value: 0.9 },
        { label: t("settings.account.sizeM"), value: 1 },
        { label: t("settings.account.sizeL"), value: 1.1 },
        { label: t("settings.account.sizeXL"), value: 1.2 }
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

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName);
            setLastName(user.lastName);
            setSessionSync(user.sessionSync || "same_browser");
            loadPasskeys();
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
            <div className="account-section">
                <h2><Icon path={mdiAccountEdit} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.accountName")}</h2>
                <div className="section-inner">
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
                <div className="section-header">
                    <h2><Icon path={mdiPalette} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.appearance")}</h2>
                    <Button
                        icon={isGroupSynced("appearance") ? mdiCloudSync : mdiCloudOffOutline}
                        onClick={() => {
                            if (!user) {
                                sendToast(t("common.error"), t("settings.account.syncLoginRequired"));
                                return;
                            }
                            const wasSynced = isGroupSynced("appearance");
                            toggleGroupSync("appearance");
                            sendToast(
                                t("common.success"), 
                                wasSynced ? t("settings.account.appearanceSyncDisabled") : t("settings.account.appearanceSyncEnabled")
                            );
                        }}
                        type={isGroupSynced("appearance") ? "primary" : undefined}
                    />
                </div>
                <div className="section-inner appearance-section">
                    <p style={{ maxWidth: "25rem" }}>{t("settings.account.appearanceDescription")}</p>
                    <div className="appearance-content">
                        <div className="theme-selector">
                            <span className="theme-label">{t("settings.account.themeLabel")}</span>
                            <div className="appearance-control-container">
                                <div className="theme-boxes">
                                    <div 
                                        className={`theme-box ${themeMode === 'light' ? 'active' : ''}`}
                                        onClick={() => setTheme('light')}
                                    >
                                        <div className="theme-icon">
                                            <Icon path={mdiWhiteBalanceSunny} size={1} />
                                        </div>
                                        <span className="theme-name">{t("settings.account.themeLight")}</span>
                                    </div>
                                    <Tooltip text={t("settings.account.themeDarkHint")} delay={500}>
                                        <div 
                                            className={`theme-box ${themeMode === 'dark' ? 'active' : ''} ${themeMode === 'oled' ? 'active oled-active' : ''}`}
                                            onClick={() => {
                                                if (themeMode === 'oled') {
                                                    setTheme('dark');
                                                    setDarkClickCount(0);
                                                    sendToast(t("common.success"), t("settings.account.oledDisabled"));
                                                } else if (themeMode === 'dark') {
                                                    clearTimeout(darkClickTimeout.current);
                                                    const newCount = darkClickCount + 1;
                                                    setDarkClickCount(newCount);
                                                    if (newCount >= 3) {
                                                        setTheme('oled');
                                                        setDarkClickCount(0);
                                                        sendToast(t("common.success"), t("settings.account.oledEnabled"));
                                                    } else {
                                                        darkClickTimeout.current = setTimeout(() => setDarkClickCount(0), 1000);
                                                    }
                                                } else {
                                                    setTheme('dark');
                                                    setDarkClickCount(0);
                                                }
                                            }}
                                        >
                                            <div className="theme-icon">
                                                <Icon path={mdiWeatherNight} size={1} />
                                            </div>
                                            <span className="theme-name">{themeMode === 'oled' ? t("settings.account.themeOled") : t("settings.account.themeDark")}</span>
                                        </div>
                                    </Tooltip>
                                    <div 
                                        className={`theme-box ${themeMode === 'auto' ? 'active' : ''}`}
                                        onClick={() => setTheme('auto')}
                                    >
                                        <div className="theme-icon auto-icon">
                                            <span className="light-half">
                                                <Icon path={mdiWhiteBalanceSunny} size={0.4} />
                                            </span>
                                            <span className="dark-half">
                                                <Icon path={mdiWeatherNight} size={0.4} />
                                            </span>
                                        </div>
                                        <span className="theme-name">{t("settings.account.themeAuto")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="accent-selector">
                            <span className="accent-label">{t("settings.account.accentColor")}</span>
                            <div className="accent-colors-container">
                                <div className="accent-colors">
                                    {accentColors.map((color) => (
                                        <div
                                            key={color.value}
                                            className={`accent-color ${accentColor === color.value ? 'active' : ''}`}
                                            style={{ backgroundColor: color.value }}
                                            onClick={() => setAccentColor(color.value)}
                                            title={color.name}
                                        >
                                            {accentColor === color.value && (
                                                <Icon path={mdiCheck} size={0.6} className="check-icon" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="size-selector">
                            <span className="size-label">{t("settings.account.sizeLabel")}</span>
                            <div className="appearance-control-container">
                                <SelectBox options={sizeOptions} selected={uiScale} setSelected={setUiScale} />
                            </div>
                        </div>
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
                <div className="passkeys-list">
                    {passkeys.length > 0 ? (
                        passkeys.map(passkey => (
                            <div className="passkey-item" key={passkey.id}>
                                <div className="passkey-info">
                                    <Icon path={mdiKeyVariant} className="passkey-icon" />
                                    <div className="passkey-details">
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
                                        <p className="passkey-date">
                                            {t("settings.account.passkeys.createdAt", { 
                                                date: new Date(passkey.createdAt).toLocaleDateString(),
                                                interpolation: { escapeValue: false }
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="passkey-actions">
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
                        <div className="no-passkeys">
                            <p>{t("settings.account.passkeys.noPasskeys")}</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};