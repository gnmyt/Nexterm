import "./styles.sass";
import NextermLogo from "@/common/components/NextermLogo";
import {
    mdiCog,
    mdiLogout,
    mdiServerOutline,
    mdiCodeBraces,
    mdiChartBoxOutline,
    mdiShieldCheckOutline,
} from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import Tooltip from "@/common/components/Tooltip";
import { useTranslation } from "react-i18next";

export const Sidebar = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const { logout, user } = useContext(UserContext);

    const navigation = [
        { title: t('common.sidebar.servers'), path: "/servers", icon: mdiServerOutline },
        { title: t('common.sidebar.monitoring'), path: "/monitoring", icon: mdiChartBoxOutline},
        { title: t('common.sidebar.snippets'), path: "/snippets", icon: mdiCodeBraces },
        { title: t('common.sidebar.audit'), path: "/audit", icon: mdiShieldCheckOutline },
    ];


    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    return (
        <>
            <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
                <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen}
                                     text={t('common.sidebar.logoutConfirmText', { username: user?.username })}
                                     onConfirm={logout} />
                <div className="sidebar-top">
                    <Tooltip text={t('common.sidebar.collapseTitle')} disabled={isCollapsed}>
                        <div className="sidebar-logo" onClick={() => setIsCollapsed(!isCollapsed)} title={t('common.sidebar.collapseTitle')}>
                            <NextermLogo size={64} />
                        </div>
                    </Tooltip>
                    <hr />

                    <nav>
                        {navigation.map((item, index) => {
                            return (
                                <Tooltip key={index} text={item.title}>
                                    <div onClick={() => navigate(item.path)}
                                         className={"nav-item" + (isActive(item.path) ? " nav-item-active" : "")}>
                                        <Icon path={item.icon} />
                                    </div>
                                </Tooltip>
                            );
                        })}
                    </nav>
                </div>

                <div className="log-out-area">
                    <Tooltip text={t('common.sidebar.logout')}>
                        <div className="log-out-btn" onClick={() => setLogoutDialogOpen(true)}>
                            <Icon path={mdiLogout} />
                        </div>
                    </Tooltip>

                    <Tooltip text={t('common.sidebar.settings')}>
                        <div
                            className={"nav-item" + (isActive("/settings") ? " nav-item-active" : "")}
                            onClick={() => navigate("/settings")}
                        >
                            <Icon path={mdiCog} />
                        </div>
                    </Tooltip>
                </div>

            </div>
        </>
    );
};