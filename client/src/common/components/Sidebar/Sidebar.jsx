import "./styles.sass";
import NextermLogo from "@/common/components/NextermLogo";
import { mdiCog, mdiLogout, mdiServerOutline, mdiCodeBraces, mdiChartBoxOutline, mdiShieldCheckOutline, mdiAccountCogOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Tooltip from "@/common/components/Tooltip";
import { useTranslation } from "react-i18next";
import { SettingsDialog } from "@/common/components/SettingsDialog";

export const Sidebar = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useContext(UserContext);

    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);
    const userButtonRef = useRef(null);
    const hoverTimeoutRef = useRef(null);

    const getUserInitials = () => {
        if (user?.firstName && user?.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        return user?.username?.slice(0, 2).toUpperCase() || "??";
    };

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setUserMenuOpen(true);
    };

    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => setUserMenuOpen(false), 150);
    };

    useEffect(() => () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }, []);

    const navigation = [
        { title: t('common.sidebar.servers'), path: "/servers", icon: mdiServerOutline },
        { title: t('common.sidebar.monitoring'), path: "/monitoring", icon: mdiChartBoxOutline },
        { title: t('common.sidebar.snippets'), path: "/snippets", icon: mdiCodeBraces },
        { title: t('common.sidebar.audit'), path: "/audit", icon: mdiShieldCheckOutline },
    ];

    const isActive = (path) => location.pathname.startsWith(path);

    return (
        <>
            <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
                <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen}
                    text={t('common.sidebar.logoutConfirmText', { username: user?.username })} onConfirm={logout} />
                <div className="sidebar-top">
                    <Tooltip text={t('common.sidebar.collapseTitle')} disabled={isCollapsed}>
                        <div className="sidebar-logo" onClick={() => setIsCollapsed(!isCollapsed)} title={t('common.sidebar.collapseTitle')}>
                            <NextermLogo size={64} />
                        </div>
                    </Tooltip>
                    <hr />
                    <nav>
                        {navigation.map((item, index) => (
                            <Tooltip key={index} text={item.title}>
                                <div onClick={() => navigate(item.path)} className={`nav-item${isActive(item.path) ? " nav-item-active" : ""}`}>
                                    <Icon path={item.icon} />
                                </div>
                            </Tooltip>
                        ))}
                    </nav>
                </div>
                <div className="sidebar-bottom">
                    <div className="user-account-area" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                        <Tooltip text={user?.username || t('common.sidebar.account')} disabled={userMenuOpen}>
                            <div ref={userButtonRef} className={`user-btn ${userMenuOpen ? 'active' : ''}`}>
                                <Icon path={mdiAccountCogOutline} />
                            </div>
                        </Tooltip>
                        <div ref={userMenuRef} className={`user-menu ${userMenuOpen ? 'open' : ''}`}>
                            <div className="user-menu-header">
                                <div className="user-avatar"><span>{getUserInitials()}</span></div>
                                <div className="user-info">
                                    <span className="user-name">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || t('common.sidebar.account')}</span>
                                    <span className="user-username">@{user?.username}</span>
                                </div>
                            </div>
                            <div className="user-menu-separator" />
                            <div className={`user-menu-item ${settingsDialogOpen ? 'active' : ''}`} onClick={() => { setSettingsDialogOpen(true); setUserMenuOpen(false); }}>
                                <Icon path={mdiCog} className="menu-icon" />
                                <span className="menu-label">{t('common.sidebar.settings')}</span>
                            </div>
                            <div className="user-menu-item danger" onClick={() => { setLogoutDialogOpen(true); setUserMenuOpen(false); }}>
                                <Icon path={mdiLogout} className="menu-icon" />
                                <span className="menu-label">{t('common.sidebar.logout')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />
        </>
    );
};