import Icon from "@mdi/react";
import "./styles.sass";
import { useLocation, useNavigate } from "react-router-dom";

export const SettingsNavigation = ({pages}) => {

    const location = useLocation();
    const navigate = useNavigate();

    const endsWith = (path) => {
        return location.pathname.endsWith(path);
    }

    return (
        <div className="settings-navigation">
            {pages.map((page, index) => (
                <div key={index} className={"settings-item" + (endsWith(page.title.toLowerCase()) ? " settings-item-active" : "")}
                     onClick={() => navigate("/settings/" + page.title.toLowerCase())}>
                    <Icon path={page.icon} />
                    <h2>{page.title}</h2>
                </div>
            ))}
        </div>
    );
};