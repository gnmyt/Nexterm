import "./styles.sass";
import Button from "@/common/components/Button";
import { mdiPlay, mdiScript, mdiEye, mdiPencil, mdiTrashCan } from "@mdi/js";
import Icon from "@mdi/react";

export const ScriptItem = ({ onClick, onView, onEdit, onDelete, icon, title, description, running, isCustom }) => {

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
        <div className="script-item">
            <div className="script-header">
                <div className="script-icon">
                    <Icon path={mdiScript} />
                </div>

                <div className="script-info">
                    <div className="script-title-row">
                        <h2>{title}</h2>
                        {isCustom && <span className="custom-badge">Custom</span>}
                    </div>
                    <p className="script-version">Script</p>
                </div>
            </div>

            <p className="script-description">{description}</p>

            <div className="action-area">
                <div className="top-buttons">
                    <Button text={isCustom ? "Edit" : "View"} icon={isCustom ? mdiPencil : mdiEye} type="secondary"
                            onClick={handleViewEdit} />
                    {isCustom && (
                        <Button text="Delete" icon={mdiTrashCan} type="danger" onClick={handleDelete} />
                    )}
                </div>
                <Button text={running ? "Running..." : "Run"} icon={running ? null : mdiPlay} disabled={running}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick && onClick();
                        }} />
            </div>
        </div>
    );
};
