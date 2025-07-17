import "./styles.sass";
import Button from "@/common/components/Button";
import { mdiPlay, mdiScript, mdiEye, mdiPencil, mdiTrashCan } from "@mdi/js";
import Icon from "@mdi/react";
import { useTranslation } from "react-i18next";

export const ScriptItem = ({ onClick, onView, onEdit, onDelete, title, description, running, isCustom, isEasterEgg }) => {
    const { t } = useTranslation();

    const handleViewEdit = () => {
        if (isCustom && onEdit) {
            onEdit();
        } else if (!isCustom && onView) {
            onView();
        }
    }

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete();
        }
    }

    return (
        <div className={`script-item ${isEasterEgg ? 'easter-egg' : ''}`}>
            <div className="script-header">
                <div className={`script-icon ${isEasterEgg ? 'easter-egg-icon' : ''}`}>
                    <Icon path={mdiScript} />
                </div>

                <div className="script-info">
                    <div className="script-title-row">
                        <h2>{title}</h2>
                        {isCustom && <span className="custom-badge">{t("apps.items.customBadge")}</span>}
                    </div>
                    <p className="script-version">{t("apps.items.scriptType")}</p>
                </div>
            </div>

            <p className="script-description">{description}</p>

            <div className="action-area">
                <div className="top-buttons">
                    <Button text={isCustom ? t("apps.actions.edit") : t("apps.actions.view")} icon={isCustom ? mdiPencil : mdiEye} type="secondary"
                            onClick={handleViewEdit} />
                    {isCustom && (
                        <Button text={t("apps.actions.delete")} icon={mdiTrashCan} type="danger" onClick={handleDelete} />
                    )}
                </div>
                <Button text={running ? t("apps.items.running") : t("apps.items.runScript")} icon={running ? null : mdiPlay} disabled={running}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick && onClick();
                        }} />
            </div>
        </div>
    );
};
