import "./styles.sass";
import Icon from "@mdi/react";
import { mdiAccountCircleOutline, mdiClockStarFourPointsOutline } from "@mdi/js";
import SettingsNavigation from "./components/SettingsNavigation";
import { Navigate, useLocation } from "react-router-dom";
import Account from "@/pages/Settings/pages/Account";
import Sessions from "@/pages/Settings/pages/Sessions";

export const Settings = () => {
    const location = useLocation();

    const pages = [
        { title: "Account", icon: mdiAccountCircleOutline, content: <Account /> },
        { title: "Sessions", icon: mdiClockStarFourPointsOutline, content: <Sessions /> }
    ];

    const currentPage = pages.find(page => location.pathname.endsWith(page.title.toLowerCase()));

    if (!currentPage) return <Navigate to="/settings/account" />;
    
    return (
        <div className="settings-page">
            <SettingsNavigation pages={pages} />
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