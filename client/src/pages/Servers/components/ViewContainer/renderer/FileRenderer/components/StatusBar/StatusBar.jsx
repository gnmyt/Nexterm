import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiEyeOffOutline, mdiEyeOutline, mdiViewGridOutline, mdiViewListOutline, mdiViewSequentialOutline, mdiFolderOutline, mdiFileOutline } from "@mdi/js";
import "./styles.sass";

const StatusButton = ({ icon, active = false, ...props }) => (
    <button type="button" className={`status-btn${active ? " active" : ""}`} {...props}>
        <Icon path={icon} />
    </button>
);

export const StatusBar = ({ folderCount, fileCount, hiddenCount, selectedCount, showHiddenFiles, onToggleHiddenFiles, viewMode, setViewMode }) => {
    const { t } = useTranslation();

    return (
        <div className="file-status-bar">
            <div className="status-counts">
                <span className="status-count" title={t("servers.fileManager.status.folders", { count: folderCount })}>
                    <Icon path={mdiFolderOutline} />{folderCount}
                </span>
                <span className="status-count" title={t("servers.fileManager.status.files", { count: fileCount })}>
                    <Icon path={mdiFileOutline} />{fileCount}
                </span>
                {hiddenCount > 0 && !showHiddenFiles && (
                    <span className="status-hint">{t("servers.fileManager.status.hidden", { count: hiddenCount })}</span>
                )}
                {selectedCount > 0 && (
                    <span className="status-selection">{t("servers.fileManager.status.selected", { count: selectedCount })}</span>
                )}
            </div>
            <div className="status-actions">
                <StatusButton icon={showHiddenFiles ? mdiEyeOutline : mdiEyeOffOutline} active={showHiddenFiles}
                              onClick={onToggleHiddenFiles}
                              title={t(showHiddenFiles ? "servers.fileManager.status.hideHidden" : "servers.fileManager.status.showHidden")} />
                <div className="status-divider" />
                <div className="view-switch">
                    <StatusButton icon={mdiViewListOutline} active={viewMode === "list"} onClick={() => setViewMode("list")}
                                  title={t("servers.fileManager.actionBar.switchToList")} />
                    <StatusButton icon={mdiViewSequentialOutline} active={viewMode === "compact"} onClick={() => setViewMode("compact")}
                                  title={t("servers.fileManager.actionBar.switchToCompact")} />
                    <StatusButton icon={mdiViewGridOutline} active={viewMode === "grid"} onClick={() => setViewMode("grid")}
                                  title={t("servers.fileManager.actionBar.switchToGrid")} />
                </div>
            </div>
        </div>
    );
};
