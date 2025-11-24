import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { mdiAccountCircleOutline, mdiWhiteBalanceSunny, mdiAccountEdit, mdiPalette, mdiShieldCheck, mdiLockReset, mdiTranslate, mdiSync, mdiCloudSync, mdiWeb, mdiTabUnselected, mdiThemeLightDark, mdiWeatherNight, mdiMagicStaff } from "@mdi/js";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useTheme } from "@/common/contexts/ThemeContext.jsx";
import Button from "@/common/components/Button";
import { patchRequest, postRequest } from "@/common/utils/RequestUtil.js";
import TwoFactorAuthentication from "@/pages/Settings/pages/Account/dialogs/TwoFactorAuthentication";
import PasswordChange from "@/pages/Settings/pages/Account/dialogs/PasswordChange";
import { useTranslation } from "react-i18next";
import SelectBox from "@/common/components/SelectBox";
import { languages } from "@/i18n.js";
import i18n from "@/i18n.js";
import Icon from "@mdi/react";

export const Account = () => {
    const { t } = useTranslation();
    const [twoFactorOpen, setTwoFactorOpen] = useState(false);
    const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);

    const { user, login } = useContext(UserContext);
    const { themeMode, setTheme } = useTheme();

    const [updatedField, setUpdatedField] = useState(null);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [currentLanguage, setCurrentLanguage] = useState(localStorage.getItem("language") || "en");
    const [sessionSync, setSessionSync] = useState("same_browser");

    const languageOptions = languages.map(lang => ({ label: lang.name, value: lang.code }));
    
    const themeOptions = [
        { label: t("settings.account.themeAuto"), value: "auto", icon: mdiMagicStaff },
        { label: t("settings.account.themeLight"), value: "light", icon: mdiWhiteBalanceSunny },
        { label: t("settings.account.themeDark"), value: "dark", icon: mdiWeatherNight }
    ];

    const sessionSyncOptions = [
        { label: t("settings.account.sessionSyncAcrossDevices"), value: "across_devices", icon: mdiCloudSync },
        { label: t("settings.account.sessionSyncSameBrowser"), value: "same_browser", icon: mdiWeb },
        { label: t("settings.account.sessionSyncSameTab"), value: "same_tab", icon: mdiTabUnselected }
    ];

    const changeLanguage = (languageCode) => {
        setCurrentLanguage(languageCode);
        localStorage.setItem("language", languageCode);
        i18n.changeLanguage(languageCode);
    };

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

    useEffect(() => {
        if (user) {
            setFirstName(user.firstName);
            setLastName(user.lastName);
            setSessionSync(user.sessionSync || "same_browser");
        }
    }, [user]);

    return (
        <div className="account-page">
            <TwoFactorAuthentication open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />
            <PasswordChange open={passwordChangeOpen} onClose={() => setPasswordChangeOpen(false)} />
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
                <h2><Icon path={mdiPalette} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.appearance")}</h2>
                <div className="section-inner">
                    <p style={{ maxWidth: "25rem" }}>{t("settings.account.appearanceDescription")}</p>
                    <SelectBox options={themeOptions} selected={themeMode} setSelected={setTheme} />
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
                <h2><Icon path={mdiTranslate} size={0.8} style={{marginRight: '8px'}} />{t("settings.account.language")}</h2>
                <div className="section-inner">
                    <div className="language-help">
                        <p className="main-description">{t("settings.account.languageDescription")}</p>
                        <p className="translate-help">
                            {t("settings.account.missingLanguage")}
                            <a href="https://crowdin.com/project/nexterm" target="_blank" rel="noopener noreferrer"
                               className="translate-link">
                                {t("settings.account.helpTranslateLink")}
                            </a>
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

        </div>
    );
};