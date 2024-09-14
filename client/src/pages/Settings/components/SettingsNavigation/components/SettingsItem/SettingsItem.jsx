import "./styles.sass";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";

export const SettingsItem = ({icon, title}) => {

    const location = useLocation();
    const navigate = useNavigate();

    const endsWith = (path) => {
        return location.pathname.endsWith(path);
    }

    return (
        <div className={"settings-item" + (endsWith(title.toLowerCase()) ? " settings-item-active" : "")}
             onClick={() => navigate("/settings/" + title.toLowerCase())}>
            <Icon path={icon} />
            <h2>{title}</h2>
        </div>
    )
}