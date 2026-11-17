import "./styles.sass";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiCloudDownload, mdiPencil, mdiTrashCan } from "@mdi/js";
import Tooltip from "@/common/components/Tooltip";
import Button from "@/common/components/Button";

export const ThemeCard = ({ theme, isActive, onToggle, onEdit, onDelete, canEdit }) => {
    const { t } = useTranslation();
    return (
        <div
            className={`css-theme-card ${isActive ? "active" : ""}`}
            onClick={onToggle}
        >
            <div className="css-theme-card-top">
                <div className="css-theme-card-info">
                    <h4>{theme.name}</h4>
                    {theme.description && <p className="css-theme-card-desc">{theme.description}</p>}
                </div>
                <div className="css-theme-card-badges">
                    {theme.sourceId && (
                        <Tooltip text={t("settings.account.customThemes.fromSource")} delay={500} asChild>
                            <span className="source-badge">
                                <Icon path={mdiCloudDownload} size={0.5} />
                            </span>
                        </Tooltip>
                    )}
                </div>
            </div>
            {canEdit && (
                <div className="css-theme-card-actions" onClick={(e) => e.stopPropagation()}>
                    {onEdit && (
                        <Button icon={mdiPencil} onClick={onEdit} title={t("settings.account.customThemes.edit")} />
                    )}
                    {onDelete && (
                        <Button type="danger" icon={mdiTrashCan} onClick={onDelete} title={t("settings.account.customThemes.delete")} />
                    )}
                </div>
            )}
        </div>
    );
};
