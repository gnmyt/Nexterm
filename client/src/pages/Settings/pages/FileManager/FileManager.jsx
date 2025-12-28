import "./styles.sass";
import { useFileSettings } from "@/common/contexts/FileSettingsContext.jsx";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiViewGrid, mdiViewList, mdiImage, mdiEyeOff, mdiShieldCheck, mdiCursorMove, mdiFileMove, mdiContentCopy, mdiHelpCircle } from "@mdi/js";
import ToggleSwitch from "@/common/components/ToggleSwitch";

const SettingItem = ({ icon, title, description, children }) => (
    <div className="setting-item">
        <div className="setting-info">
            {icon && (
                <div className="setting-icon">
                    <Icon path={icon} size={0.9} />
                </div>
            )}
            <div className="setting-label">
                <h4>{title}</h4>
                <p>{description}</p>
            </div>
        </div>
        {children}
    </div>
);

const ViewOption = ({ icon, label, selected, onClick }) => (
    <div className={`view-option ${selected ? "selected" : ""}`} onClick={onClick}>
        <Icon path={icon} size={0.9} />
        <span>{label}</span>
    </div>
);

export const FileManager = () => {
    const { t } = useTranslation();
    const { 
        showThumbnails, setShowThumbnails,
        defaultViewMode, setDefaultViewMode,
        showHiddenFiles, setShowHiddenFiles,
        confirmBeforeDelete, setConfirmBeforeDelete,
        dragDropAction, setDragDropAction,
    } = useFileSettings();

    return (
        <div className="file-manager-settings">
            <div className="settings-section">
                <h2>{t("settings.fileManager.title")}</h2>
                <p>{t("settings.fileManager.description")}</p>

                <SettingItem 
                    icon={mdiViewGrid}
                    title={t("settings.fileManager.defaultView.title")} 
                    description={t("settings.fileManager.defaultView.description")}
                >
                    <div className="view-options">
                        <ViewOption 
                            icon={mdiViewGrid} 
                            label={t("settings.fileManager.defaultView.grid")} 
                            selected={defaultViewMode === "grid"}
                            onClick={() => setDefaultViewMode("grid")}
                        />
                        <ViewOption 
                            icon={mdiViewList} 
                            label={t("settings.fileManager.defaultView.list")} 
                            selected={defaultViewMode === "list"}
                            onClick={() => setDefaultViewMode("list")}
                        />
                    </div>
                </SettingItem>

                <SettingItem 
                    icon={mdiImage}
                    title={t("settings.fileManager.thumbnails.title")} 
                    description={t("settings.fileManager.thumbnails.description")}
                >
                    <ToggleSwitch 
                        id="show-thumbnails" 
                        checked={showThumbnails} 
                        onChange={setShowThumbnails} 
                    />
                </SettingItem>

                <SettingItem 
                    icon={mdiEyeOff}
                    title={t("settings.fileManager.hiddenFiles.title")} 
                    description={t("settings.fileManager.hiddenFiles.description")}
                >
                    <ToggleSwitch 
                        id="show-hidden-files" 
                        checked={showHiddenFiles} 
                        onChange={setShowHiddenFiles} 
                    />
                </SettingItem>

                <SettingItem 
                    icon={mdiShieldCheck}
                    title={t("settings.fileManager.deleteConfirmation.title")} 
                    description={t("settings.fileManager.deleteConfirmation.description")}
                >
                    <ToggleSwitch 
                        id="confirm-before-delete" 
                        checked={confirmBeforeDelete} 
                        onChange={setConfirmBeforeDelete} 
                    />
                </SettingItem>

                <SettingItem 
                    icon={mdiCursorMove}
                    title={t("settings.fileManager.dragDropAction.title")} 
                    description={t("settings.fileManager.dragDropAction.description")}
                >
                    <div className="view-options three-options">
                        <ViewOption 
                            icon={mdiFileMove} 
                            label={t("settings.fileManager.dragDropAction.move")} 
                            selected={dragDropAction === "move"}
                            onClick={() => setDragDropAction("move")}
                        />
                        <ViewOption 
                            icon={mdiContentCopy} 
                            label={t("settings.fileManager.dragDropAction.copy")} 
                            selected={dragDropAction === "copy"}
                            onClick={() => setDragDropAction("copy")}
                        />
                        <ViewOption 
                            icon={mdiHelpCircle} 
                            label={t("settings.fileManager.dragDropAction.ask")} 
                            selected={dragDropAction === "ask"}
                            onClick={() => setDragDropAction("ask")}
                        />
                    </div>
                </SettingItem>
            </div>
        </div>
    );
};
