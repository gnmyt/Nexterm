import Icon from "@mdi/react";
import "./styles.sass";
import { useLocation, useNavigate } from "react-router-dom";
import { mdiWrench } from "@mdi/js";

export const AppNavigation = () => {

    const categories = [
        { title: "Utilities", icon: mdiWrench },
    ]

    const location = useLocation();
    const navigate = useNavigate();

    const endsWith = (path) => {
        return location.pathname.endsWith(path);
    }

    return (
        <div className="app-navigation">
            {categories.map((category, index) => (
                <div key={index}
                     className={"settings-item" + (endsWith(category.title.toLowerCase()) ? " settings-item-active" : "")}
                     onClick={() => navigate("/apps/" + category.title.toLowerCase())}>
                    <Icon path={category.icon} />
                    <h2>{category.title}</h2>
                </div>
            ))}
        </div>
    );
};