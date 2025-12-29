import { createPortal } from "react-dom";
import { useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose, mdiLogout } from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { getSettingsUserPages, getSettingsAdminPages } from "@/common/utils/navigationConfig.js";
import "./styles.sass";

export const SettingsDialog = ({ open, onClose, initialTab = "account" }) => {
    const { t } = useTranslation();
    const { user, logout } = useContext(UserContext);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

    const userPages = useMemo(() => getSettingsUserPages(t), [t]);
    const adminPages = useMemo(() => getSettingsAdminPages(t), [t]);

    const allPages = [...userPages, ...(user?.role === "admin" ? adminPages : [])];
    const currentPage = allPages.find(p => p.key === activeTab) || userPages[0];
    const handleClose = useCallback(() => setIsClosing(true), []);

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
            setIsVisible(true);
            setIsClosing(false);
        } else if (isVisible) setIsClosing(true);
    }, [open, initialTab]);

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
