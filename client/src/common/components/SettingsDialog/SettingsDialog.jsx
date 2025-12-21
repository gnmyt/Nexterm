import { createPortal } from "react-dom";
import { useContext, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import {
    mdiClose, mdiAccountCircleOutline, mdiAccountGroup, mdiClockStarFourPointsOutline,
    mdiShieldAccountOutline, mdiDomain, mdiCreationOutline, mdiKeyVariant, mdiConsole,
    mdiKeyboardOutline, mdiCloudDownloadOutline, mdiChartLine, mdiLogout,
} from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Account from "@/pages/Settings/pages/Account";
import Sessions from "@/pages/Settings/pages/Sessions";
import Users from "@/pages/Settings/pages/Users";
import Authentication from "@/pages/Settings/pages/Authentication";
import Organizations from "@/pages/Settings/pages/Organizations";
import AI from "@/pages/Settings/pages/AI";
import Identities from "@/pages/Settings/pages/Identities";
import Terminal from "@/pages/Settings/pages/Terminal";
import Keymaps from "@/pages/Settings/pages/Keymaps";
import Sources from "@/pages/Settings/pages/Sources";
import Monitoring from "@/pages/Settings/pages/Monitoring";
import "./styles.sass";

export const SettingsDialog = ({ open, onClose }) => {
    const { t } = useTranslation();
    const { user, logout } = useContext(UserContext);
    const [activeTab, setActiveTab] = useState("account");
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

    const userPages = [
        { title: t("settings.pages.account"), key: "account", icon: mdiAccountCircleOutline, content: <Account /> },
        { title: t("settings.pages.terminal"), key: "terminal", icon: mdiConsole, content: <Terminal /> },
        { title: t("settings.pages.keymaps"), key: "keymaps", icon: mdiKeyboardOutline, content: <Keymaps /> },
        { title: t("settings.pages.identities"), key: "identities", icon: mdiKeyVariant, content: <Identities /> },
        {
            title: t("settings.pages.sessions"),
            key: "sessions",
            icon: mdiClockStarFourPointsOutline,
            content: <Sessions />,
        },
        { title: t("settings.pages.organizations"), key: "organizations", icon: mdiDomain, content: <Organizations /> },
    ];

    const adminPages = [
        { title: t("settings.pages.users"), key: "users", icon: mdiAccountGroup, content: <Users /> },
        {
            title: t("settings.pages.authentication"),
            key: "authentication",
            icon: mdiShieldAccountOutline,
            content: <Authentication />,
        },
        { title: t("settings.pages.sources"), key: "sources", icon: mdiCloudDownloadOutline, content: <Sources /> },
        { title: t("settings.pages.monitoring"), key: "monitoring", icon: mdiChartLine, content: <Monitoring /> },
        { title: t("settings.pages.ai"), key: "ai", icon: mdiCreationOutline, content: <AI /> },
    ];

    const allPages = [...userPages, ...(user?.role === "admin" ? adminPages : [])];
    const currentPage = allPages.find(p => p.key === activeTab) || userPages[0];
    const handleClose = useCallback(() => setIsClosing(true), []);

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            setIsClosing(false);
        } else if (isVisible) setIsClosing(true);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, handleClose]);

    const handleAnimationEnd = () => {
        if (isClosing) {
            setIsVisible(false);
            setIsClosing(false);
            onClose();
        }
    };

    const renderNavItem = (page) => (
        <div key={page.key} className={`nav-item ${activeTab === page.key ? "active" : ""}`}
             onClick={() => setActiveTab(page.key)}>
            <Icon path={page.icon} className="nav-icon" />
            <span className="nav-label">{page.title}</span>
        </div>
    );

    if (!isVisible) return null;

    return createPortal(
        <>
            <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen}
                                 text={t("common.sidebar.logoutConfirmText", { username: user?.username })}
                                 onConfirm={logout} />
            <div className={`settings-dialog-overlay ${isClosing ? "closing" : ""}`}
                 onAnimationEnd={handleAnimationEnd}>
                <div className="settings-dialog">
                    <div className="settings-dialog-sidebar">
                        <div className="settings-dialog-nav">
                            <p className="nav-section-title">{t("settings.userSettings")}</p>
                            <div className="nav-group">{userPages.map(renderNavItem)}</div>
                            {user?.role === "admin" && (
                                <>
                                    <p className="nav-section-title">{t("settings.adminSettings")}</p>
                                    <div className="nav-group">{adminPages.map(renderNavItem)}</div>
                                </>
                            )}
                            <div className="nav-separator" />
                            <div className="nav-group">
                                <div className="nav-item danger" onClick={() => setLogoutDialogOpen(true)}>
                                    <Icon path={mdiLogout} className="nav-icon" />
                                    <span className="nav-label">{t("common.sidebar.logout")}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="settings-dialog-content">
                        <div className="settings-dialog-header">
                            <Icon path={currentPage.icon} className="header-icon" />
                            <h1>{currentPage.title}</h1>
                        </div>
                        <hr className="settings-dialog-header-line" />
                        <div className="settings-dialog-body">{currentPage.content}</div>
                    </div>
                    <button className="settings-dialog-close" onClick={handleClose}><Icon path={mdiClose} /></button>
                </div>
            </div>
        </>,
        document.body,
    );
};

export default SettingsDialog;
