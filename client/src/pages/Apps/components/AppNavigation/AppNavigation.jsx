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
import { useTranslation } from "react-i18next";

export const AppNavigation = ({ search, setSearch }) => {
    const { t } = useTranslation();

    const categories = [
        { title: "scripts", icon: mdiScript, translationKey: "apps.navigation.categories.scripts" },
        { title: "networking", icon: mdiLan, translationKey: "apps.navigation.categories.networking" },
        { title: "media", icon: mdiFolderMultipleImage, translationKey: "apps.navigation.categories.media" },
        { title: "cloud", icon: mdiCloud, translationKey: "apps.navigation.categories.cloud" },
        { title: "development", icon: mdiCodeTags, translationKey: "apps.navigation.categories.development" },
        { title: "utilities", icon: mdiWrench, translationKey: "apps.navigation.categories.utilities" },
    ];

    const location = useLocation();
    const navigate = useNavigate();

    const endsWith = (path) => {
        if (path === "/") return location.pathname === "/apps/" || location.pathname === "/apps";
        return location.pathname.endsWith(path);
    };

    const switchCategory = (category) => {
        setSearch("");
        navigate("/apps/" + category.title);
    };

    return (
        <div className="app-navigation">
            <ServerSearch search={search} setSearch={setSearch} />

            <div className={"settings-item" + (endsWith("/") ? " settings-item-active" : "")}
                 onClick={() => navigate("/apps/")}>
                <Icon path={search ? mdiMagnify : mdiPackageVariant} />
                <h2>{search ? t("apps.navigation.categories.results") : t("apps.navigation.categories.all")}</h2>
            </div>

            {categories.map((category, index) => (
                <div key={index}
                     className={"settings-item" + (endsWith(category.title) ? " settings-item-active" : "")}
                     onClick={() => switchCategory(category)}>
                    <Icon path={category.icon} />
                    <h2>{t(category.translationKey)}</h2>
                </div>
            ))}
        </div>
    );
};