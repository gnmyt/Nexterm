import React, { memo, useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiDotsVertical, mdiLinkVariant, mdiChevronRight } from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Tooltip from "@/common/components/Tooltip";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import {
    convertUnits, isThumbnailSupported, formatPermissionsString, formatOctal, formatModified, childPath,
} from "../../utils/fileUtils";
import { getFileIcon } from "@/common/utils/fileIcons.js";

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
                                  onDoubleClick,
                                  onContextMenu,
                                  onDotsClick,
                                  onDotsPointerDown,
                                  onDragStart,
                                  onDragEnd,
                                  onDragOver,
                                  onDragLeave,
                                  onDrop,
                                  itemRef,
                                  isExpandable = false,
                                  isExpanded = false,
                                  isExpandLoading = false,
                                  onToggleExpand,
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
        const fullPath = childPath(path, item.name);
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
        isExpanded && "expanded",
    ].filter(Boolean).join(" ");

    const depth = item.depth ?? 0;
    const icon = getFileIcon(item, { expanded: isExpanded });

    return (
        <div
            ref={itemRef}
            className={classNames}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            draggable={!isRenaming}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            tabIndex={0}
        >
            <div className="file-name" style={depth > 0 && viewMode === "list" ? { paddingLeft: `${depth * 1.25}rem` } : undefined}>
                {viewMode === "list" && (
                    isExpandable ? (
                        <Icon path={mdiChevronRight}
                              className={`expand-toggle${isExpanded ? " open" : ""}${isExpandLoading ? " loading" : ""}`}
                              onClick={onToggleExpand}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              title={t(isExpanded ? "servers.fileManager.item.collapse" : "servers.fileManager.item.expand")} />
                    ) : <span className="expand-spacer" />
                )}
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
                        path={icon.path}
                        className={`${item.type === "folder" ? "folder-icon" : "type-icon"}${icon.brand ? " brand-icon" : ""}`}
                        style={{ color: icon.color }}
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
                {item.isSymlink && (
                    <span className="symlink-badge" title={t("servers.fileManager.item.link")}>
                        <Icon path={mdiLinkVariant} /><span>{t("servers.fileManager.item.link")}</span>
                    </span>
                )}
            </div>
            {viewMode === "grid" && !isRenaming && (
                <p className="file-meta">{item.type === "file" ? convertUnits(item.size) : formatModified(item.last_modified)}</p>
            )}
            {viewMode === "list" && (
                <>
                    <p className="file-size">{item.type === "file" && convertUnits(item.size)}</p>
                    <Tooltip text={`${formatOctal(item.mode)} - ${formatPermissionsString(item.mode)}`} delay={500} asChild>
                        <p className="file-permissions">
                            <span className="perms-text">{formatPermissionsString(item.mode)}</span>
                        </p>
                    </Tooltip>
                    <Tooltip text={new Date(item.last_modified * 1000).toLocaleString()} delay={500} asChild>
                        <p className="file-date">{formatModified(item.last_modified)}</p>
                    </Tooltip>
                </>
            )}
            <Icon
                path={mdiDotsVertical}
                className="dots-menu"
                onClick={onDotsClick}
                onPointerDown={onDotsPointerDown}
                onDoubleClick={(e) => e.stopPropagation()}
            />
        </div>
    );
});