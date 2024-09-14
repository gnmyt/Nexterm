import "./styles.sass";
import NextermLogo from "@/common/img/logo.png";
import { mdiCog, mdiLogout, mdiPackageVariant, mdiServerOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { Link, useLocation } from "react-router-dom";
import { useContext, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";

export const Sidebar = () => {
    const location = useLocation();

    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

    const {logout, user} = useContext(UserContext);

    const navigation = [
        { title: "Settings", path: "/settings", icon: mdiCog },
        { title: "Servers", path: "/servers", icon: mdiServerOutline },
        { title: "Apps", path: "/apps", icon: mdiPackageVariant },
    ];

    const isActive = (path) => {
        return location.pathname.startsWith(path);
    }

    return (
        <div className="sidebar">
            <ActionConfirmDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen}
                                 text={`This will log you out of the ${user?.username} account. Are you sure?`}
                                    onConfirm={logout} />
            <div className="sidebar-top">
                <img src={NextermLogo} alt="Nexterm Logo" />
                <hr />

                <nav>
                    {navigation.map((item, index) => (
                        <Link key={index} className={"nav-item" + (isActive(item.path) ? " nav-item-active " : "")}
                              to={item.path}>
                            <Icon path={item.icon} />
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="log-out-btn" onClick={() => setLogoutDialogOpen(true)}>
                <Icon path={mdiLogout} />
            </div>
        </div>
    );
};