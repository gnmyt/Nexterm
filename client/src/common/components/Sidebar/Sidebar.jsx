import "./styles.sass";
import NextermLogo from "@/common/components/NextermLogo";
import { mdiCog, mdiLogout, mdiAccountCogOutline, mdiStarOutline, mdiLifebuoy } from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import SupportDialog from "@/common/components/SupportDialog";
import Tooltip from "@/common/components/Tooltip";
import { useTranslation } from "react-i18next";
import { SettingsDialog } from "@/common/components/SettingsDialog/SettingsDialog.jsx";
import { getSidebarNavigation } from "@/common/utils/navigationConfig.jsx";
import { GITHUB_URL } from "@/App.jsx";

export const Sidebar = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useContext(UserContext);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState("account");
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [supportDialogOpen, setSupportDialogOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const hoverTimeoutRef = useRef(null);

    const getUserInitials = () => user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : user?.username?.slice(0, 2).toUpperCase() || "??";
    const handleMouseEnter = () => { clearTimeout(hoverTimeoutRef.current); setUserMenuOpen(true); };
    const handleMouseLeave = () => { hoverTimeoutRef.current = setTimeout(() => setUserMenuOpen(false), 150); };

    useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);
    useEffect(() => {
        const handleOpenSettings = event => { setSettingsTab(event.detail?.tab || "account"); setSettingsDialogOpen(true); };
        window.addEventListener("openSettings", handleOpenSettings);
        return () => window.removeEventListener("openSettings", handleOpenSettings);
    }, []);

    const navigation = getSidebarNavigation(t);

    return (<>
        <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
            <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} text={t('common.sidebar.logoutConfirmText', { username: user?.username })} onConfirm={logout} />
            <div className="sidebar-top">
                <Tooltip text={t('common.sidebar.collapseTitle')} disabled={isCollapsed}>
                    <div className="sidebar-logo" onClick={() => setIsCollapsed(!isCollapsed)} title={t('common.sidebar.collapseTitle')}><NextermLogo size={64} /></div>
                </Tooltip>
                <hr />
                <nav>
                    {navigation.map((item, i) => (
                        <Tooltip key={i} text={item.title}>
                            <div onClick={() => navigate(item.path)} className={`nav-item${location.pathname.startsWith(item.path) ? " nav-item-active" : ""}`}><Icon path={item.icon} /></div>
                        </Tooltip>
                    ))}
                </nav>
            </div>
            <div className="sidebar-bottom">
                <div className="user-account-area" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    <Tooltip text={user?.username || t('common.sidebar.account')} disabled={userMenuOpen}>
                        <div className={`user-btn ${userMenuOpen ? 'active' : ''}`}><Icon path={mdiAccountCogOutline} /></div>
                    </Tooltip>
                    <div className={`user-menu ${userMenuOpen ? 'open' : ''}`}>
                        <div className="user-menu-header">
                            <div className="user-avatar"><span>{getUserInitials()}</span></div>
                            <div className="user-info">
                                <span className="user-name">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || t('common.sidebar.account')}</span>
                                <span className="user-username">@{user?.username}</span>
                            </div>
                        </div>
                        <div className="user-menu-separator" />
                        <div className={`user-menu-item ${settingsDialogOpen ? 'active' : ''}`} onClick={() => { setSettingsDialogOpen(true); setUserMenuOpen(false); }}>
                            <Icon path={mdiCog} className="menu-icon" /><span className="menu-label">{t('common.sidebar.settings')}</span>
                        </div>
                        <div className="user-menu-separator" />
                        <div className="user-menu-item star" onClick={() => { window.open(GITHUB_URL, "_blank"); setUserMenuOpen(false); }}>
                            <Icon path={mdiStarOutline} className="menu-icon" /><span className="menu-label">{t('common.sidebar.starOnGitHub')}</span>
                        </div>
                        <div className={`user-menu-item support ${supportDialogOpen ? 'active' : ''}`} onClick={() => { setSupportDialogOpen(true); setUserMenuOpen(false); }}>
                            <Icon path={mdiLifebuoy} className="menu-icon" /><span className="menu-label">{t('common.sidebar.support')}</span>
                        </div>
                        <div className="user-menu-separator" />
                        <div className="user-menu-item danger" onClick={() => { setLogoutDialogOpen(true); setUserMenuOpen(false); }}>
                            <Icon path={mdiLogout} className="menu-icon" /><span className="menu-label">{t('common.sidebar.logout')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <SettingsDialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} initialTab={settingsTab} />
        <SupportDialog open={supportDialogOpen} onClose={() => setSupportDialogOpen(false)} />
    </>);
};