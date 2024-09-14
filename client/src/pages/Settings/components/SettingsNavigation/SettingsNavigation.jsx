import "./styles.sass";
import SettingsItem from "./components/SettingsItem";
import { useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";

export const SettingsNavigation = ({ userPages, adminPages }) => {

    const { user } = useContext(UserContext);

    return (
        <div className="settings-navigation">
            <p>USER SETTINGS</p>

            <div className="settings-group">
                {userPages.map((page, index) => (
                    <SettingsItem key={index} icon={page.icon} title={page.title} />
                ))}
            </div>

            {user?.role === "admin" && <p>ADMIN SETTINGS</p>}
            {user?.role === "admin" && <div className="settings-group">
                {adminPages.map((page, index) => (
                    <SettingsItem key={index} icon={page.icon} title={page.title} />
                ))}
            </div>}
        </div>
    );
};