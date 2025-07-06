import Icon from "@mdi/react";
import "./styles.sass";
import { useLocation, useNavigate } from "react-router-dom";
import {
    mdiCloud,
    mdiCodeTags,
    mdiFolderMultipleImage,
    mdiLan,
    mdiMagnify,
    mdiPackageVariant,
    mdiScript,
    mdiWrench,
} from "@mdi/js";
import ServerSearch from "@/pages/Servers/components/ServerList/components/ServerSearch";

export const AppNavigation = ({ search, setSearch }) => {

    const categories = [
        { title: "Scripts", icon: mdiScript },
        { title: "Networking", icon: mdiLan },
        { title: "Media", icon: mdiFolderMultipleImage },
        { title: "Cloud", icon: mdiCloud },
        { title: "Development", icon: mdiCodeTags },
        { title: "Utilities", icon: mdiWrench },
    ];

    const location = useLocation();
    const navigate = useNavigate();

    const endsWith = (path) => {
        if (path === "/") return location.pathname === "/apps/" || location.pathname === "/apps";
        return location.pathname.endsWith(path);
    };

    const switchCategory = (category) => {
        setSearch("");
        navigate("/apps/" + category.title.toLowerCase());
    };

    return (
        <div className="app-navigation">
            <ServerSearch search={search} setSearch={setSearch} />

            <div className={"settings-item" + (endsWith("/") ? " settings-item-active" : "")}
                 onClick={() => navigate("/apps/")}>
                <Icon path={search ? mdiMagnify : mdiPackageVariant} />
                <h2>{search ? "Results" : "All"}</h2>
            </div>

            {categories.map((category, index) => (
                <div key={index}
                     className={"settings-item" + (endsWith(category.title.toLowerCase()) ? " settings-item-active" : "")}
                     onClick={() => switchCategory(category)}>
                    <Icon path={category.icon} />
                    <h2>{category.title}</h2>
                </div>
            ))}
        </div>
    );
};