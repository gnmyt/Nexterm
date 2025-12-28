import React, { useState, useContext } from "react";
import "./styles.sass";
import Icon from "@mdi/react";
import {
    mdiArchive,
    mdiDotsVertical,
    mdiFile,
    mdiFileDocument,
    mdiFolder,
    mdiImage,
    mdiMovie,
    mdiMusicNote,
    mdiAlertCircle,
    mdiFormTextbox,
    mdiTextBoxEdit,
    mdiFileDownload,
    mdiTrashCan,
    mdiLinkVariant,
    mdiEye,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import RenameItemDialog from "./components/RenameItemDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useTranslation } from "react-i18next";
import { useFileSettings } from "@/common/contexts/FileSettingsContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";

export const FileList = ({
                             items,
                             updatePath,
                             path,
                             sendOperation,
                             downloadFile,
                             setCurrentFile,
                             setPreviewFile,
                             loading,
                             viewMode = "list",
                             error,
                             resolveSymlink,
                             session,
                         }) => {
    const { t } = useTranslation();
    const { showThumbnails, showHiddenFiles, confirmBeforeDelete } = useFileSettings();
    const { sessionToken } = useContext(UserContext);
    const [selectedItem, setSelectedItem] = useState(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [bigFileDialogOpen, setBigFileDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [thumbnailErrors, setThumbnailErrors] = useState({});

    const contextMenu = useContextMenu();

    const THUMBNAIL_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

    const isThumbnailSupported = (filename) => {
        const ext = filename.split(".").pop()?.toLowerCase();
        return THUMBNAIL_EXTENSIONS.includes(ext);
    };

    const getThumbnailUrl = (filename) => {
        const baseUrl = getBaseUrl();
        const fullPath = `${path.endsWith("/") ? path : path + "/"}${filename}`;
        return `${baseUrl}/api/entries/sftp-download?sessionId=${session.id}&path=${encodeURIComponent(fullPath)}&sessionToken=${sessionToken}&thumbnail=true&size=100`;
    };

    const handleThumbnailError = (filename) => {
        setThumbnailErrors(prev => ({ ...prev, [filename]: true }));
    };

    const getIconByFileEnding = (ending) => {
        const icons = {
            jpg: mdiImage, jpeg: mdiImage, png: mdiImage, gif: mdiImage, bmp: mdiImage,
            mp3: mdiMusicNote, wav: mdiMusicNote, flac: mdiMusicNote, ogg: mdiMusicNote,
            mp4: mdiMovie, avi: mdiMovie, mov: mdiMovie, mkv: mdiMovie,
            txt: mdiFileDocument, log: mdiFileDocument, md: mdiFileDocument,
            zip: mdiArchive, rar: mdiArchive, "7z": mdiArchive,
        };
        return icons[ending] || mdiFile;
    };

    const getIconColor = (item) => {
        if (item.type === "folder") return "";

        const ending = item.name.split(".").pop()?.toLowerCase();
        const colorMap = {
            jpg: "#ff6b6b", jpeg: "#ff6b6b", png: "#ff6b6b", gif: "#ff6b6b", bmp: "#ff6b6b",
            mp3: "#51cf66", wav: "#51cf66", flac: "#51cf66", ogg: "#51cf66",
            mp4: "#ffa500", avi: "#ffa500", mov: "#ffa500", mkv: "#ffa500",
            txt: "#74c0fc", log: "#74c0fc", md: "#74c0fc",
            zip: "#ffd43b", rar: "#ffd43b", "7z": "#ffd43b",
        };
        return colorMap[ending] || "#adb5bd";
    };

    const convertUnits = (bytes) => {
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        if (bytes === 0) return "0 Byte";
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
    };

    const isPreviewable = (filename) => {
        const extension = filename.split(".").pop()?.toLowerCase();
        const previewableExtensions = [
            "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
            "mp4", "webm", "ogg", "mov",
            "mp3", "wav", "ogg", "flac", "m4a",
            "pdf",
        ];
        return previewableExtensions.includes(extension);
    };

    const handleClick = (item) => {
        const fullPath = `${path.endsWith("/") ? path : path + "/"}${item.name}`;
        if (item.isSymlink) {
            resolveSymlink?.(fullPath, (result) => {
                if (result.isDirectory) {
                    updatePath(result.path);
                } else if (isPreviewable(result.path)) {
                    setPreviewFile?.(result.path);
                } else if (result.size < 1024 * 1024) {
                    setCurrentFile(result.path);
                } else {
                    downloadFile(result.path);
                }
            });
        } else if (item.type === "folder") {
            updatePath(fullPath);
        } else if (item.type === "file" && isPreviewable(item.name)) {
            setPreviewFile?.(fullPath);
        } else if (item.type === "file" && item.size < 1024 * 1024) {
            setCurrentFile(fullPath);
        } else {
            downloadFile(fullPath);
        }
    };

    const handleContextMenu = (event, item, fromDots = false) => {
        event.preventDefault();
        setSelectedItem(item);
        if (fromDots) event.stopPropagation();
        contextMenu.open(event, fromDots ? undefined : { x: event.pageX, y: event.pageY });
    };

    const handleDelete = () => sendOperation(selectedItem.type === "folder" ? 0x7 : 0x6, { path: `${path}/${selectedItem.name}` });
    const handleDeleteClick = () => {
        if (confirmBeforeDelete) {
            setDeleteDialogOpen(true);
        } else {
            handleDelete();
        }
    };
    const handleDownload = () => downloadFile(`${path}/${selectedItem.name}`);
    const handleRename = (newName) => sendOperation(0x8, {
        path: `${path}/${selectedItem.name}`,
        newPath: `${path}/${newName}`,
    });
    const openFile = () => selectedItem.type === "file" && selectedItem.size >= 1024 * 1024 ? setBigFileDialogOpen(true) : setCurrentFile(`${path}/${selectedItem.name}`);
    const handlePreview = () => setPreviewFile?.(`${path}/${selectedItem.name}`);

    const filteredItems = showHiddenFiles 
        ? items 
        : items.filter(item => !item.name.startsWith("."));

    return (
        <div className={`file-list ${viewMode}`}>
            {viewMode === "list" && (
                <div className="file-list-header">
                    <div className="header-name">Name</div>
                    <div className="header-size">Size</div>
                    <div className="header-date">Modified</div>
                    <div className="header-actions"></div>
                </div>
            )}
            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading files...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <Icon path={mdiAlertCircle} />
                    <h3>Access Denied</h3>
                    <p>{error}</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="empty-state">
                    <Icon path={mdiFolder} />
                    <h3>This folder is empty</h3>
                    <p>Drop files here to upload them</p>
                </div>
            ) : (
                <div className="file-items-container">
                    {filteredItems
                        .sort((a, b) => b.type.localeCompare(a.type) || a.name.localeCompare(b.name))
                        .map((item, index) => {
                            const canShowThumbnail = viewMode === "grid" && 
                                showThumbnails && 
                                item.type === "file" && 
                                isThumbnailSupported(item.name) && 
                                !thumbnailErrors[item.name];
                            
                            return (
                            <div
                                key={index}
                                className={`file-item ${focusedIndex === index ? "focused" : ""} ${viewMode} ${item.isSymlink ? "symlink" : ""} ${canShowThumbnail ? "has-thumbnail" : ""}`}
                                onClick={() => handleClick(item)}
                                onContextMenu={(e) => handleContextMenu(e, item)}
                                onMouseEnter={() => setFocusedIndex(index)}
                                onMouseLeave={() => setFocusedIndex(-1)}
                                tabIndex={0}
                            >
                                <div className="file-name">
                                    {canShowThumbnail ? (
                                        <img 
                                            src={getThumbnailUrl(item.name)} 
                                            alt={item.name}
                                            className="file-thumbnail"
                                            loading="lazy"
                                            onError={() => handleThumbnailError(item.name)}
                                        />
                                    ) : (
                                        <Icon
                                            path={item.type === "folder" ? mdiFolder : getIconByFileEnding(item.name.split(".").pop()?.toLowerCase())}
                                            style={{ color: getIconColor(item) }}
                                        />
                                    )}
                                    <h2 title={item.name}>{item.name}</h2>
                                    {item.isSymlink && (
                                        <span className="symlink-badge">
                                            <Icon path={mdiLinkVariant} />
                                            link
                                        </span>
                                    )}
                                </div>
                                {viewMode === "list" && (
                                    <>
                                        <p className="file-size">{item.type === "file" && convertUnits(item.size)}</p>
                                        <p className="file-date">{new Date(item.last_modified * 1000).toLocaleDateString()}</p>
                                    </>
                                )}
                                <Icon
                                    path={mdiDotsVertical}
                                    className="dots-menu"
                                    onClick={(e) => handleContextMenu(e, item, true)}
                                />
                            </div>
                        )})
                    }
                </div>
            )}

            <RenameItemDialog
                open={renameDialogOpen}
                closeDialog={() => setRenameDialogOpen(false)}
                renameItem={handleRename}
                item={selectedItem}
            />

            <ActionConfirmDialog
                open={bigFileDialogOpen}
                setOpen={setBigFileDialogOpen}
                onConfirm={() => setCurrentFile(path + "/" + selectedItem?.name)}
                text={t("servers.fileManager.contextMenu.bigFileConfirm", { size: Math.round(selectedItem?.size / 1024 / 1024) })}
            />

            <ActionConfirmDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                onConfirm={handleDelete}
                text={t("servers.fileManager.contextMenu.deleteConfirm", { name: selectedItem?.name })}
            />

            <ContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                onClose={contextMenu.close}
                trigger={contextMenu.triggerRef}
            >
                <ContextMenuItem
                    icon={mdiFormTextbox}
                    label={t("servers.fileManager.contextMenu.rename")}
                    onClick={() => setRenameDialogOpen(true)}
                />
                {selectedItem?.type === "file" && (
                    <>
                        {isPreviewable(selectedItem.name) && (
                            <ContextMenuItem
                                icon={mdiEye}
                                label={t("servers.fileManager.contextMenu.preview")}
                                onClick={handlePreview}
                            />
                        )}
                        <ContextMenuItem
                            icon={mdiTextBoxEdit}
                            label={t("servers.fileManager.contextMenu.edit")}
                            onClick={openFile}
                        />
                    </>
                )}
                <ContextMenuItem
                    icon={mdiFileDownload}
                    label={t("servers.fileManager.contextMenu.download")}
                    onClick={handleDownload}
                />
                <ContextMenuItem
                    icon={mdiTrashCan}
                    label={t("servers.fileManager.contextMenu.delete")}
                    onClick={handleDeleteClick}
                    danger
                />
            </ContextMenu>
        </div>
    );
};