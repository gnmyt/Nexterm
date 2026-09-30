import React, { memo, useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiDotsVertical, mdiFolder, mdiLinkVariant } from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Tooltip from "@/common/components/Tooltip";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import {
    getExtension, getIconByFileEnding, getIconColor, convertUnits, isThumbnailSupported,
    formatPermissionsString, formatOctal,
} from "../../utils/fileUtils";

export const FileItem = memo(({
                                  item,
                                  viewMode,
                                  path,
                                  session,
                                  isSelected,
                                  isFocused,
                                  isRenaming,
                                  isBeingDragged,
                                  isDropTarget,
                                  isCut,
                                  isDimmed,
                                  showThumbnails,
                                  highlight,
                                  renameValue,
                                  onRenameChange,
                                  onRenameKeyDown,
                                  onRenameBlur,
                                  onClick,
                                  onContextMenu,
                                  onDotsClick,
                                  onDotsPointerDown,
                                  onDragStart,
                                  onDragEnd,
                                  onDragOver,
                                  onDragLeave,
                                  onDrop,
                                  itemRef,
                              }) => {
    const { t } = useTranslation();
    const { sessionToken } = useContext(UserContext);
    const [thumbnailError, setThumbnailError] = useState(false);

    const canShowThumbnail = viewMode === "grid" && showThumbnails && item.type === "file"
        && isThumbnailSupported(item.name) && !thumbnailError;

    const renderName = () => {
        const index = highlight ? item.name.toLowerCase().indexOf(highlight) : -1;
        if (index === -1) return item.name;
        return (
            <>
                {item.name.slice(0, index)}
                <span className="search-highlight">{item.name.slice(index, index + highlight.length)}</span>
                {item.name.slice(index + highlight.length)}
            </>
        );
    };

    const getThumbnailUrl = () => {
        const fullPath = `${path.endsWith("/") ? path : path + "/"}${item.name}`;
        return `${getBaseUrl()}/api/entries/sftp?sessionId=${session.id}&path=${encodeURIComponent(fullPath)}&sessionToken=${sessionToken}&thumbnail=true&size=100`;
    };

    const classNames = [
        "file-item",
        viewMode,
        isFocused && "focused",
        item.isSymlink && "symlink",
        canShowThumbnail && "has-thumbnail",
        isSelected && "selected",
        isRenaming && "renaming",
        isBeingDragged && "dragging",
        isDropTarget && "drop-target",
        isCut && "cut",
        isDimmed && "dimmed",
    ].filter(Boolean).join(" ");

    return (
        <div
            ref={itemRef}
            className={classNames}
            onClick={onClick}
            onContextMenu={onContextMenu}
            draggable={!isRenaming}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            tabIndex={0}
        >
            <div className="file-name">
                {canShowThumbnail ? (
                    <img
                        src={getThumbnailUrl()}
                        alt={item.name}
                        className="file-thumbnail"
                        loading="lazy"
                        onError={() => setThumbnailError(true)}
                    />
                ) : (
                    <Icon
                        path={item.type === "folder" ? mdiFolder : getIconByFileEnding(getExtension(item.name))}
                        style={{ color: getIconColor(item) }}
                    />
                )}
                {isRenaming ? (
                    <input
                        type="text"
                        className="rename-input"
                        value={renameValue}
                        onChange={onRenameChange}
                        onKeyDown={onRenameKeyDown}
                        onBlur={onRenameBlur}
                        onMouseDown={(e) => e.stopPropagation()}
                        autoFocus
                    />
                ) : (
                    <Tooltip text={item.name} delay={500} asChild>
                        <h2>{renderName()}</h2>
                    </Tooltip>
                )}
                {item.isSymlink && <span className="symlink-badge"><Icon path={mdiLinkVariant} />{t("servers.fileManager.item.link")}</span>}
            </div>
            {viewMode === "list" && (
                <>
                    <p className="file-size">{item.type === "file" && convertUnits(item.size)}</p>
                    <Tooltip text={`${formatOctal(item.mode)} - ${formatPermissionsString(item.mode)}`} delay={500} asChild>
                        <p className="file-permissions">
                            <span className="perms-text">{formatPermissionsString(item.mode)}</span>
                        </p>
                    </Tooltip>
                    <p className="file-date">{new Date(item.last_modified * 1000).toLocaleDateString()}</p>
                </>
            )}
            <Icon
                path={mdiDotsVertical}
                className="dots-menu"
                onClick={onDotsClick}
                onPointerDown={onDotsPointerDown}
            />
        </div>
    );
});