import "./styles.sass";
import NextermLogo from "@/common/img/logo.png";
import { mdiCog, mdiLogout, mdiPackageVariant, mdiServerOutline, mdiCodeBrackets, mdiChartBoxOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";

export const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [navigationDialogOpen, setNavigationDialogOpen] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const { logout, user } = useContext(UserContext);
    const { activeSessions, setActiveSessions } = useActiveSessions();

    const navigation = [
        { title: "Settings", path: "/settings", icon: mdiCog },
        { title: "Servers", path: "/servers", icon: mdiServerOutline },
        { title: "Monitoring", path: "/monitoring", icon: mdiChartBoxOutline},
        { title: "Snippets", path: "/snippets", icon: mdiCodeBrackets },
        { title: "Apps", path: "/apps", icon: mdiPackageVariant },
    ];

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    };

    const hasActiveSessions = () => {
        return location.pathname === "/servers" && activeSessions.length > 0;
    }

    const handleNavigation = (path) => {
        if (hasActiveSessions() && !location.pathname.startsWith(path)) {
            setPendingNavigation(path);
            setNavigationDialogOpen(true);
        } else {
            navigate(path);
        }
    }

    const confirmNavigation = () => {
        setNavigationDialogOpen(false);
        if (pendingNavigation) {
            setActiveSessions([]);
            navigate(pendingNavigation);
            setPendingNavigation(null);
        }
    }

    return (
        <>
            <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <ActionConfirmDialog
                    open={navigationDialogOpen}
                    setOpen={setNavigationDialogOpen}
                    text="You have active sessions. Navigating away will disconnect you from all servers. Are you sure?"
                    onConfirm={confirmNavigation}
                />
                <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen}
                                     text={`This will log you out of the ${user?.username} account. Are you sure?`}
                                     onConfirm={logout} />
                <div className="sidebar-top">
                    <img src={NextermLogo} alt="Nexterm Logo" onClick={() => setIsCollapsed(!isCollapsed)}
                         title="Collapse Sidebar" />
                    <hr />

                    <nav>
                        {navigation.map((item, index) => {
                            const isDisabled = hasActiveSessions() && !location.pathname.startsWith(item.path);

                            return (
                                <div key={index} onClick={() => handleNavigation(item.path)}
                                     className={"nav-item" + (isActive(item.path) ? " nav-item-active" : "") + (isDisabled ? " nav-item-disabled" : "")}>
                                    <Icon path={item.icon} />
                                </div>
                            );
                        })}
                    </nav>
                </div>

                <div className="log-out-btn" onClick={() => setLogoutDialogOpen(true)}>
                    <Icon path={mdiLogout} />
                </div>
            </div>
        </>
    );
};