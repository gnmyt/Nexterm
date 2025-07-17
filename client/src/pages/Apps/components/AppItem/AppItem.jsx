import "./styles.sass";
import Button from "@/common/components/Button";
import { mdiRocketLaunch } from "@mdi/js";
import { useTranslation } from "react-i18next";

export const AppItem = ({ onClick, icon, version, title, description, installing }) => {
    const { t } = useTranslation();

    return (
        <div className="app-item">
            <div className="app-header">
                <div className="app-img">
                    <img src={icon} alt={title} />
                </div>

                <div className="app-info">
                    <h2>{title}</h2>
                    <p>{t("apps.actions.version")} {version}</p>
                </div>
            </div>

            <p>{description}</p>

            <div className="action-area">
                <Button text={t("apps.actions.deploy")} icon={mdiRocketLaunch} onClick={onClick} disabled={installing} />
            </div>
        </div>
    );
};