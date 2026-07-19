import "./styles.sass";
import NextermLogo from "@/common/components/NextermLogo";
import { mdiCog, mdiLogout, mdiAccountCogOutline, mdiStarOutline, mdiLifebuoy, mdiServerNetwork, mdiPlus, mdiClose } from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext, useState, useRef, useEffect } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import SupportDialog from "@/common/components/SupportDialog";
import Tooltip from "@/common/components/Tooltip";
import LetterAvatar from "@/common/components/LetterAvatar";
import { useTranslation } from "react-i18next";
import { SettingsDialog } from "@/common/components/SettingsDialog/SettingsDialog.jsx";
import { getSidebarNavigation } from "@/common/utils/navigationConfig.jsx";
import { GITHUB_URL } from "@/App.jsx";
import { openExternalUrl } from "@/common/utils/TauriUtil.js";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import { getServers, getActiveServerId, getServerDisplayName, switchServer, removeServer } from "@/common/utils/ConnectorServers.js";
import { getAvatarLabel } from "@/common/utils/avatar.js";

export const Sidebar = ({ onToggleCollapse }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, isConnectorMode, user, setAddingServer, hasPermission } = useContext(UserContext);
    const { uiScale } = usePreferences();
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState("account");
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [removeServerDialogOpen, setRemoveServerDialogOpen] = useState(false);
    const [serverToRemove, setServerToRemove] = useState(null);
    const [supportDialogOpen, setSupportDialogOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const hoverTimeoutRef = useRef(null);

    const servers = isConnectorMode ? getServers() : [];
    const activeServerId = isConnectorMode ? getActiveServerId() : null;

    const handleMouseEnter = () => { clearTimeout(hoverTimeoutRef.current); setUserMenuOpen(true); };
    const handleMouseLeave = () => { hoverTimeoutRef.current = setTimeout(() => setUserMenuOpen(false), 150); };

    useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);
    useEffect(() => {
        const handleOpenSettings = event => { setSettingsTab(event.detail?.tab || "account"); setSettingsDialogOpen(true); };
        window.addEventListener("openSettings", handleOpenSettings);
        return () => window.removeEventListener("openSettings", handleOpenSettings);
    }, []);

    const navigation = getSidebarNavigation(t).filter(item => !item.permission || hasPermission(item.permission));

    return (<>
        <div className="sidebar">
            <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} text={t('common.sidebar.logoutConfirmText', { username: user?.username })} onConfirm={logout} />
            {isConnectorMode && <ActionConfirmDialog open={removeServerDialogOpen} setOpen={setRemoveServerDialogOpen}
                text={t('common.serverSwitcher.removeConfirmText', { server: serverToRemove ? getServerDisplayName(serverToRemove) : '' })}
                onConfirm={() => {
                    if (!serverToRemove) return;
                    if (serverToRemove.id === activeServerId) logout();
                    else { removeServer(serverToRemove.id); setServerToRemove(null); }
                }} />}
            <div className="sidebar-top">
                <Tooltip text={t('common.sidebar.collapseTitle')}>
                    <div className="sidebar-logo nexterm-logo" onClick={onToggleCollapse} title={t('common.sidebar.collapseTitle')}><NextermLogo size={48 * uiScale} /></div>
                </Tooltip>
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
                            <LetterAvatar user={user} size="md" showTooltip={false} />
                            <div className="user-info">
                                <span className="user-name">{getAvatarLabel(user, t('common.sidebar.account'))}</span>
                                <span className="user-username">@{user?.username}</span>
                            </div>
                        </div>
                        {isConnectorMode && servers.length > 0 && (<>
                            <div className="user-menu-separator" />
                            <div className="user-menu-section-label">{t('common.serverSwitcher.title')}</div>
                            {servers.map(server => (
                                <div key={server.id} className={`user-menu-item server-item ${server.id === activeServerId ? 'active' : ''}`}
                                     onClick={() => { if (server.id !== activeServerId) { setUserMenuOpen(false); switchServer(server.id); } }}>
                                    <Icon path={mdiServerNetwork} className="menu-icon" />
                                    <span className="menu-label">{getServerDisplayName(server)}</span>
                                    <button className="server-remove-btn" onClick={(e) => { e.stopPropagation(); setServerToRemove(server); setRemoveServerDialogOpen(true); }}>
                                        <Icon path={mdiClose} size={0.55} />
                                    </button>
                                </div>
                            ))}
                            <div className="user-menu-item add-server" onClick={() => { setUserMenuOpen(false); setAddingServer(true); }}>
                                <Icon path={mdiPlus} className="menu-icon" />
                                <span className="menu-label">{t('common.serverSwitcher.addServer')}</span>
                            </div>
                        </>)}
                        <div className="user-menu-separator" />
                        <div className={`user-menu-item ${settingsDialogOpen ? 'active' : ''}`} onClick={() => { setSettingsDialogOpen(true); setUserMenuOpen(false); }}>
                            <Icon path={mdiCog} className="menu-icon" /><span className="menu-label">{t('common.sidebar.settings')}</span>
                        </div>
                        <div className="user-menu-separator" />
                        <div className="user-menu-item star" onClick={() => { openExternalUrl(GITHUB_URL); setUserMenuOpen(false); }}>
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