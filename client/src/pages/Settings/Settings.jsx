import "./styles.sass";
import Icon from "@mdi/react";
import { mdiAccountCircleOutline, mdiAccountGroup, mdiClockStarFourPointsOutline, mdiShieldAccountOutline, mdiDomain, mdiCreationOutline, mdiKeyVariant, mdiConsole, mdiKeyboardOutline, mdiCloudDownloadOutline } from "@mdi/js";
import SettingsNavigation from "./components/SettingsNavigation";
import { Navigate, useLocation } from "react-router-dom";
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
import { useTranslation } from "react-i18next";

export const Settings = () => {
    const { t } = useTranslation();
    const location = useLocation();

    const userPages = [
        { title: t("settings.pages.account"), routeKey: "account", icon: mdiAccountCircleOutline, content: <Account /> },
        { title: t("settings.pages.terminal"), routeKey: "terminal", icon: mdiConsole, content: <Terminal /> },
        { title: t("settings.pages.keymaps"), routeKey: "keymaps", icon: mdiKeyboardOutline, content: <Keymaps /> },
        { title: t("settings.pages.identities"), routeKey: "identities", icon: mdiKeyVariant, content: <Identities /> },
        { title: t("settings.pages.sessions"), routeKey: "sessions", icon: mdiClockStarFourPointsOutline, content: <Sessions /> },
        { title: t("settings.pages.organizations"), routeKey: "organizations", icon: mdiDomain, content: <Organizations /> }
    ];

    const adminPages = [
        { title: t("settings.pages.users"), routeKey: "users", icon: mdiAccountGroup, content: <Users /> },
        { title: t("settings.pages.authentication"), routeKey: "authentication", icon: mdiShieldAccountOutline, content: <Authentication /> },
        { title: t("settings.pages.sources"), routeKey: "sources", icon: mdiCloudDownloadOutline, content: <Sources /> },
        { title: t("settings.pages.ai"), routeKey: "ai", icon: mdiCreationOutline, content: <AI /> }
    ];

    const currentPage = [...userPages, ...adminPages].find(page => location.pathname.endsWith(page.routeKey));

    if (!currentPage) return <Navigate to="/settings/account" />;
    
    return (
        <div className="settings-page">
            <SettingsNavigation userPages={userPages} adminPages={adminPages} />
            <div className="settings-content">
                <div className="settings-header">
                    <Icon path={currentPage.icon} />
                    <h1>{currentPage.title}</h1>
                </div>
                <hr/>

                <div className="settings-content-inner">
                    {currentPage.content}
                </div>
            </div>
        </div>
    )
}