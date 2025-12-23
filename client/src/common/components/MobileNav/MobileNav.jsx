import "./styles.sass";
import { mdiAccountCogOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSidebarNavigation } from "@/common/utils/navigationConfig";

export const MobileNav = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const navigation = getSidebarNavigation(t);

    const handleClick = (item) => {
        if (pathname.startsWith(item.path) && item.toggleEvent) window.dispatchEvent(new CustomEvent(item.toggleEvent));
        else navigate(item.path);
    };

    return (
        <nav className="mobile-nav">
            <div className="mobile-nav-scroll">
                {navigation.map((item, i) => (
                    <div key={i} onClick={() => handleClick(item)} className={`mobile-nav-item${pathname.startsWith(item.path) ? " active" : ""}`}>
                        <Icon path={item.icon} /><span>{item.title}</span>
                    </div>
                ))}
            </div>
            <div className="mobile-nav-fixed">
                <div className="mobile-nav-item" onClick={() => window.dispatchEvent(new CustomEvent("openSettings", { detail: { tab: "account" } }))}>
                    <Icon path={mdiAccountCogOutline} /><span>{t('common.sidebar.account')}</span>
                </div>
            </div>
        </nav>
    );
};

export default MobileNav;
