import "./styles.sass";
import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { useToast } from "@/common/contexts/ToastContext.jsx";
import { useTranslation } from "react-i18next";
import { getRequest, putRequest, deleteRequest } from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import ActionConfirmDialog from "@/common/components/ActionConfirmDialog";
import { applyActiveThemeCSS, removeActiveThemeCSS } from "@/common/components/ThemeLoader";
import Icon from "@mdi/react";
import {
    mdiPalette, mdiWhiteBalanceSunny, mdiWeatherNight, mdiCheck, mdiCloudSync,
    mdiCloudOffOutline, mdiPlus, mdiBrush,
} from "@mdi/js";
import ThemeCard from "./components/ThemeCard";
import ThemeEditorDialog from "./components/ThemeEditorDialog";

export const Appearance = () => {
    const { t } = useTranslation();
    const { user, login } = useContext(UserContext);
    const {
        themeMode, setTheme, accentColor, setAccentColor, accentColors,
        isGroupSynced, toggleGroupSync, theme: actualTheme,
    } = usePreferences();
    const { sendToast } = useToast();

    const [darkClickCount, setDarkClickCount] = useState(0);
    const darkClickTimeout = useRef(null);

    const [themes, setThemes] = useState([]);
    const [activeThemeId, setActiveThemeId] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editTheme, setEditTheme] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, theme: null });

    const loadThemes = async () => {
        try {
            const data = await getRequest("themes");
            setThemes(data);
        } catch (err) {
            console.error("Failed to load themes:", err);
        }
    };

    const loadActiveTheme = () => {
        if (user) setActiveThemeId(user.activeThemeId || null);
    };

    useEffect(() => {
        loadThemes();
        loadActiveTheme();
    }, [user]);

    const openCreateEditor = () => {
        setEditTheme(null);
        setEditorOpen(true);
    };

    const openEditEditor = (theme) => {
        setEditTheme(theme);
        setEditorOpen(true);
    };

    const closeEditor = () => {
        setEditorOpen(false);
        setEditTheme(null);
    };

    const handleDeleteRequest = (theme) => {
        setDeleteDialog({ open: true, theme });
    };

    const handleDeleteConfirm = async () => {
        const theme = deleteDialog.theme;
        try {
            await deleteRequest(`themes/${theme.id}`);
            sendToast(t("common.success"), t("settings.account.customThemes.themeDeleted"));
            if (activeThemeId === theme.id) {
                await putRequest("themes/active", { themeId: null });
                setActiveThemeId(null);
                removeActiveThemeCSS();
                login();
            }
            loadThemes();
        } catch (err) {
            sendToast(t("common.error"), err.message || t("settings.account.customThemes.failedToDeleteTheme"));
        }
        setDeleteDialog({ open: false, theme: null });
    };

    const toggleThemeActive = async (themeId) => {
        try {
            if (activeThemeId === themeId) {
                await putRequest("themes/active", { themeId: null });
                setActiveThemeId(null);
                removeActiveThemeCSS();
                login();
                return;
            }
            await putRequest("themes/active", { themeId });
            setActiveThemeId(themeId);
            const { css } = await getRequest(`themes/${themeId}/css`);
            applyActiveThemeCSS(css);
            login();
        } catch (err) {
            sendToast(t("common.error"), err.message || t("settings.account.customThemes.failedToActivateTheme"));
        }
    };

    return (
        <div className="appearance-page">
            <div className="appearance-section">
                <div className="section-header">
                    <h2>
                        <Icon path={mdiPalette} size={0.8} />
                        {t("settings.account.appearance")}
                    </h2>
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
                                wasSynced ? t("settings.account.appearanceSyncDisabled") : t("settings.account.appearanceSyncEnabled"),
                            );
                        }}
                        type={isGroupSynced("appearance") ? "primary" : undefined}
                    />
                </div>
                <div className="section-inner appearance-controls">
                    <p className="appearance-description">{t("settings.account.appearanceDescription")}</p>
                </div>
                <div className="section-inner">
                    <div className="appearance-content">
                        <div className="theme-selector">
                            <span className="theme-label">{t("settings.account.themeLabel")}</span>
                            <div className="theme-boxes">
                                <div
                                    className={`theme-box ${themeMode === "light" ? "active" : ""}`}
                                    onClick={() => setTheme("light")}
                                >
                                    <div className="theme-icon">
                                        <Icon path={mdiWhiteBalanceSunny} size={1} />
                                    </div>
                                    <span className="theme-name">{t("settings.account.themeLight")}</span>
                                </div>
                                <div
                                    className={`theme-box ${themeMode === "dark" ? "active" : ""} ${themeMode === "oled" ? "active oled-active" : ""}`}
                                    onClick={() => {
                                        if (themeMode === "oled") {
                                            setTheme("dark");
                                            setDarkClickCount(0);
                                            sendToast(t("common.success"), t("settings.account.oledDisabled"));
                                        } else if (themeMode === "dark") {
                                            clearTimeout(darkClickTimeout.current);
                                            const newCount = darkClickCount + 1;
                                            setDarkClickCount(newCount);
                                            if (newCount >= 3) {
                                                setTheme("oled");
                                                setDarkClickCount(0);
                                                sendToast(t("common.success"), t("settings.account.oledEnabled"));
                                            } else {
                                                darkClickTimeout.current = setTimeout(() => setDarkClickCount(0), 1000);
                                            }
                                        } else {
                                            setTheme("dark");
                                            setDarkClickCount(0);
                                        }
                                    }}
                                >
                                    <div className="theme-icon">
                                        <Icon path={mdiWeatherNight} size={1} />
                                    </div>
                                    <span className="theme-name">
                                        {themeMode === "oled" ? t("settings.account.themeOled") : t("settings.account.themeDark")}
                                    </span>
                                </div>
                                <div
                                    className={`theme-box ${themeMode === "auto" ? "active" : ""}`}
                                    onClick={() => setTheme("auto")}
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
                        <div className="accent-selector">
                            <span className="accent-label">{t("settings.account.accentColor")}</span>
                            <div className="accent-colors">
                                {accentColors.map((color) => (
                                    <div
                                        key={color.value}
                                        className={`accent-color ${accentColor === color.value ? "active" : ""}`}
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
                </div>
            </div>

            <div className="appearance-section">
                <div className="section-header">
                    <div className="header-content">
                        <h2>
                            <Icon path={mdiBrush} size={0.8} />
                            {t("settings.account.customThemes.title")}
                        </h2>
                        <p>{t("settings.account.customThemes.description")}</p>
                    </div>
                    <Button text={t("settings.account.customThemes.newTheme")} icon={mdiPlus} onClick={openCreateEditor} />
                </div>

                <div className="css-themes-grid">
                    {themes.length === 0 ? (
                        <div className="no-themes">
                            <Icon path={mdiBrush} />
                            <h3>{t("settings.account.customThemes.noThemesYet")}</h3>
                            <p>{t("settings.account.customThemes.noThemesDescription")}</p>
                        </div>
                    ) : (
                        <div className="css-theme-cards">
                            {themes.map((theme) => (
                                <ThemeCard
                                    key={theme.id}
                                    theme={theme}
                                    isActive={activeThemeId === theme.id}
                                    onToggle={() => toggleThemeActive(theme.id)}
                                    onEdit={!theme.sourceId ? () => openEditEditor(theme) : undefined}
                                    onDelete={!theme.sourceId ? () => handleDeleteRequest(theme) : undefined}
                                    canEdit={!theme.sourceId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ThemeEditorDialog
                open={editorOpen}
                onClose={closeEditor}
                editTheme={editTheme}
                onSaved={loadThemes}
                actualTheme={actualTheme}
            />

            <ActionConfirmDialog
                open={deleteDialog.open}
                setOpen={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
                onConfirm={handleDeleteConfirm}
                text={t("settings.account.customThemes.deleteConfirm", { name: deleteDialog.theme?.name })}
            />
        </div>
    );
};
