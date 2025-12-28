import React, { useState, useContext, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import "./styles.sass";
import Icon from "@mdi/react";
import {
    mdiArchive, mdiDotsVertical, mdiFile, mdiFileDocument, mdiFolder, mdiImage, mdiMovie,
    mdiMusicNote, mdiAlertCircle, mdiFormTextbox, mdiTextBoxEdit, mdiFileDownload,
    mdiTrashCan, mdiLinkVariant, mdiEye,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useTranslation } from "react-i18next";
import { useFileSettings } from "@/common/contexts/FileSettingsContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import SelectionActionBar from "../SelectionActionBar";

export const FileList = forwardRef(({
    items, updatePath, path, sendOperation, downloadFile, downloadMultipleFiles,
    setCurrentFile, setPreviewFile, loading, viewMode = "list", error,
    resolveSymlink, session, createFolder,
}, ref) => {
    const { t } = useTranslation();
    const { showThumbnails, showHiddenFiles, confirmBeforeDelete } = useFileSettings();
    const { sessionToken } = useContext(UserContext);
    
    const [selectedItem, setSelectedItem] = useState(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [renamingItem, setRenamingItem] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [bigFileDialogOpen, setBigFileDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [thumbnailErrors, setThumbnailErrors] = useState({});
    const [massDeleteDialogOpen, setMassDeleteDialogOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState(null);
    const [selectionStart, setSelectionStart] = useState(null);
    
    const containerRef = useRef(null);
    const itemRefs = useRef({});
    const contextMenu = useContextMenu();

    useImperativeHandle(ref, () => ({
        startCreateFolder: () => {
            setCreatingFolder(true);
            setNewFolderName("");
        }
    }));

    const THUMBNAIL_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
    const PREVIEWABLE_EXTENSIONS = [
        "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
        "mp4", "webm", "ogg", "mov", "mp3", "wav", "flac", "m4a", "pdf",
    ];

    const FILE_ICONS = {
        jpg: mdiImage, jpeg: mdiImage, png: mdiImage, gif: mdiImage, bmp: mdiImage,
        mp3: mdiMusicNote, wav: mdiMusicNote, flac: mdiMusicNote, ogg: mdiMusicNote,
        mp4: mdiMovie, avi: mdiMovie, mov: mdiMovie, mkv: mdiMovie,
        txt: mdiFileDocument, log: mdiFileDocument, md: mdiFileDocument,
        zip: mdiArchive, rar: mdiArchive, "7z": mdiArchive,
    };

    const FILE_COLORS = {
        jpg: "#ff6b6b", jpeg: "#ff6b6b", png: "#ff6b6b", gif: "#ff6b6b", bmp: "#ff6b6b",
        mp3: "#51cf66", wav: "#51cf66", flac: "#51cf66", ogg: "#51cf66",
        mp4: "#ffa500", avi: "#ffa500", mov: "#ffa500", mkv: "#ffa500",
        txt: "#74c0fc", log: "#74c0fc", md: "#74c0fc",
        zip: "#ffd43b", rar: "#ffd43b", "7z": "#ffd43b",
    };

    const filteredItems = useMemo(() => {
        const filtered = showHiddenFiles ? items : items.filter(item => !item.name.startsWith("."));
        return [...filtered].sort((a, b) => b.type.localeCompare(a.type) || a.name.localeCompare(b.name));
    }, [items, showHiddenFiles]);

    useEffect(() => setSelectedItems([]), [path]);

    const getExtension = (filename) => filename.split(".").pop()?.toLowerCase();
    const isThumbnailSupported = (filename) => THUMBNAIL_EXTENSIONS.includes(getExtension(filename));
    const isPreviewable = (filename) => PREVIEWABLE_EXTENSIONS.includes(getExtension(filename));

    const getThumbnailUrl = (filename) => {
        const fullPath = `${path.endsWith("/") ? path : path + "/"}${filename}`;
        return `${getBaseUrl()}/api/entries/sftp?sessionId=${session.id}&path=${encodeURIComponent(fullPath)}&sessionToken=${sessionToken}&thumbnail=true&size=100`;
    };

    const getIconByFileEnding = (ending) => FILE_ICONS[ending] || mdiFile;
    const getIconColor = (item) => item.type === "folder" ? "" : (FILE_COLORS[getExtension(item.name)] || "#adb5bd");

    const convertUnits = (bytes) => {
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        if (bytes === 0) return "0 Byte";
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
    };

    const getRelativeCoords = useCallback((event) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: event.clientX - rect.left + containerRef.current.scrollLeft,
            y: event.clientY - rect.top + containerRef.current.scrollTop,
        };
    }, []);

    const rectsIntersect = useCallback((r1, r2) => (
        !(r2.left > r1.left + r1.width || r2.left + r2.width < r1.left ||
          r2.top > r1.top + r1.height || r2.top + r2.height < r1.top)
    ), []);

    const handleSelectionStart = useCallback((event) => {
        if (event.button !== 0 || event.target.closest('.file-item')) return;
        const coords = getRelativeCoords(event);
        setSelectionStart(coords);
        setIsSelecting(true);
        setSelectionBox({ left: coords.x, top: coords.y, width: 0, height: 0 });
        if (!event.ctrlKey && !event.metaKey) setSelectedItems([]);
    }, [getRelativeCoords]);

    const handleSelectionMove = useCallback((event) => {
        if (!isSelecting || !selectionStart) return;
        const coords = getRelativeCoords(event);
        const rect = {
            left: Math.min(selectionStart.x, coords.x),
            top: Math.min(selectionStart.y, coords.y),
            width: Math.abs(coords.x - selectionStart.x),
            height: Math.abs(coords.y - selectionStart.y),
        };
        setSelectionBox(rect);

        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        
        const newSelected = filteredItems.filter((item) => {
            const itemEl = itemRefs.current[item.name];
            if (!itemEl) return false;
            const itemRect = itemEl.getBoundingClientRect();
            const itemRelRect = {
                left: itemRect.left - containerRect.left + container.scrollLeft,
                top: itemRect.top - containerRect.top + container.scrollTop,
                width: itemRect.width,
                height: itemRect.height,
            };
            return rectsIntersect(rect, itemRelRect);
        });
        setSelectedItems(newSelected);
    }, [isSelecting, selectionStart, getRelativeCoords, rectsIntersect, filteredItems]);

    const handleSelectionEnd = useCallback(() => {
        setIsSelecting(false);
        setSelectionBox(null);
        setSelectionStart(null);
    }, []);

    useEffect(() => {
        if (!isSelecting) return;
        const handleMouseMove = (event) => handleSelectionMove(event);
        const handleMouseUp = () => handleSelectionEnd();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSelecting, handleSelectionMove, handleSelectionEnd]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const container = containerRef.current;
            if (!container) return;
            const activeEl = document.activeElement;
            if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') return;
            if (!container.contains(activeEl) && container !== activeEl) return;
            
            if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
                event.preventDefault();
                setSelectedItems([...filteredItems]);
            } else if (event.key === 'Escape' && selectedItems.length > 0) {
                setSelectedItems([]);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [filteredItems, selectedItems.length]);

    const isItemSelected = useCallback((item) => (
        selectedItems.some(s => s.name === item.name && s.type === item.type)
    ), [selectedItems]);

    const handleClick = (item) => {
        const fullPath = `${path.endsWith("/") ? path : path + "/"}${item.name}`;
        if (item.isSymlink) {
            resolveSymlink?.(fullPath, (result) => {
                if (result.isDirectory) updatePath(result.path);
                else if (isPreviewable(result.path)) setPreviewFile?.(result.path);
                else if (result.size < 1024 * 1024) setCurrentFile(result.path);
                else downloadFile(result.path);
            });
        } else if (item.type === "folder") {
            updatePath(fullPath);
        } else if (isPreviewable(item.name)) {
            setPreviewFile?.(fullPath);
        } else if (item.size < 1024 * 1024) {
            setCurrentFile(fullPath);
        } else {
            downloadFile(fullPath);
        }
    };

    const handleItemClick = useCallback((event, item) => {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setSelectedItems(prev => prev.some(s => s.name === item.name)
                ? prev.filter(s => s.name !== item.name)
                : [...prev, item]
            );
            return;
        }
        if (selectedItems.length > 0) setSelectedItems([]);
        handleClick(item);
    }, [selectedItems, handleClick]);

    const handleMassDownload = useCallback(() => {
        if (selectedItems.length === 0) return;
        downloadMultipleFiles?.(selectedItems.map(item => `${path}/${item.name}`));
    }, [selectedItems, path, downloadMultipleFiles]);

    const executeMassDelete = useCallback(() => {
        selectedItems.forEach(item => {
            sendOperation(item.type === "folder" ? 0x7 : 0x6, { path: `${path}/${item.name}` });
        });
        setSelectedItems([]);
    }, [selectedItems, path, sendOperation]);

    const handleMassDelete = useCallback(() => {
        if (selectedItems.length === 0) return;
        confirmBeforeDelete ? setMassDeleteDialogOpen(true) : executeMassDelete();
    }, [selectedItems, confirmBeforeDelete, executeMassDelete]);

    const clearSelection = useCallback(() => setSelectedItems([]), []);

    const handleContextMenu = (event, item, fromDots = false) => {
        event.preventDefault();
        setSelectedItem(item);
        if (fromDots) event.stopPropagation();
        contextMenu.open(event, fromDots ? undefined : { x: event.pageX, y: event.pageY });
    };

    const getFullPath = (item) => `${path}/${item?.name}`;
    const handleDelete = () => sendOperation(selectedItem.type === "folder" ? 0x7 : 0x6, { path: getFullPath(selectedItem) });
    const handleDeleteClick = () => confirmBeforeDelete ? setDeleteDialogOpen(true) : handleDelete();
    const handleDownload = () => downloadFile(getFullPath(selectedItem));

    const handleRename = (item, newName) => {
        if (newName && newName !== item.name) {
            sendOperation(0x8, { path: getFullPath(item), newPath: `${path}/${newName}` });
        }
        setRenamingItem(null);
    };

    const startRename = (item) => {
        setRenamingItem(item);
        setRenameValue(item.name);
    };

    const handleRenameKeyDown = (event, item) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleRename(item, renameValue);
        } else if (event.key === 'Escape') {
            setRenamingItem(null);
        }
    };

    const handleCreateFolder = () => {
        if (newFolderName.trim()) createFolder(newFolderName.trim());
        setCreatingFolder(false);
    };

    const handleCreateFolderKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleCreateFolder();
        } else if (event.key === 'Escape') {
            setCreatingFolder(false);
        }
    };

    const openFile = () => selectedItem?.size >= 1024 * 1024 ? setBigFileDialogOpen(true) : setCurrentFile(getFullPath(selectedItem));
    const handlePreview = () => setPreviewFile?.(getFullPath(selectedItem));

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
            ) : filteredItems.length === 0 && !creatingFolder ? (
                <div className="empty-state">
                    <Icon path={mdiFolder} />
                    <h3>This folder is empty</h3>
                    <p>Drop files here to upload them</p>
                </div>
            ) : (
                <div
                    className="file-items-container"
                    ref={containerRef}
                    tabIndex={0}
                    onMouseDown={(event) => {
                        containerRef.current?.focus({ preventScroll: true });
                        handleSelectionStart(event);
                    }}
                >
                    {isSelecting && selectionBox && (
                        <div
                            className="selection-box"
                            style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }}
                        />
                    )}
                    {creatingFolder && (
                        <div className={`file-item ${viewMode} new-folder`} onMouseDown={(event) => event.stopPropagation()}>
                            <div className="file-name">
                                <Icon path={mdiFolder} />
                                <input
                                    type="text"
                                    className="rename-input"
                                    value={newFolderName}
                                    onChange={(event) => setNewFolderName(event.target.value)}
                                    onKeyDown={handleCreateFolderKeyDown}
                                    onBlur={handleCreateFolder}
                                    placeholder={t("servers.fileManager.createFolder.placeholder")}
                                    autoFocus
                                />
                            </div>
                            {viewMode === "list" && <><p className="file-size"></p><p className="file-date"></p></>}
                        </div>
                    )}
                    {filteredItems.map((item, index) => {
                        const canShowThumbnail = viewMode === "grid" && showThumbnails && item.type === "file" && isThumbnailSupported(item.name) && !thumbnailErrors[item.name];
                        const isRenaming = renamingItem?.name === item.name;
                        const classNames = [
                            "file-item",
                            viewMode,
                            focusedIndex === index && "focused",
                            item.isSymlink && "symlink",
                            canShowThumbnail && "has-thumbnail",
                            isItemSelected(item) && "selected",
                            isRenaming && "renaming",
                        ].filter(Boolean).join(" ");

                        return (
                            <div
                                key={item.name}
                                ref={el => itemRefs.current[item.name] = el}
                                className={classNames}
                                onClick={(event) => !isRenaming && handleItemClick(event, item)}
                                onContextMenu={(event) => handleContextMenu(event, item)}
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
                                            onError={() => setThumbnailErrors(prev => ({ ...prev, [item.name]: true }))}
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
                                            onChange={(event) => setRenameValue(event.target.value)}
                                            onKeyDown={(event) => handleRenameKeyDown(event, item)}
                                            onBlur={() => handleRename(item, renameValue)}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <h2 title={item.name}>{item.name}</h2>
                                    )}
                                    {item.isSymlink && <span className="symlink-badge"><Icon path={mdiLinkVariant} />link</span>}
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
                                    onClick={(event) => { event.stopPropagation(); handleContextMenu(event, item, true); }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            <SelectionActionBar
                selectedItems={selectedItems}
                onClearSelection={clearSelection}
                onDownload={handleMassDownload}
                onDelete={handleMassDelete}
                containerRef={containerRef}
            />

            <ActionConfirmDialog
                open={bigFileDialogOpen}
                setOpen={setBigFileDialogOpen}
                onConfirm={() => setCurrentFile(getFullPath(selectedItem))}
                text={t("servers.fileManager.contextMenu.bigFileConfirm", { size: Math.round(selectedItem?.size / 1024 / 1024) })}
            />
            <ActionConfirmDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                onConfirm={handleDelete}
                text={t("servers.fileManager.contextMenu.deleteConfirm", { name: selectedItem?.name })}
            />
            <ActionConfirmDialog
                open={massDeleteDialogOpen}
                setOpen={setMassDeleteDialogOpen}
                onConfirm={executeMassDelete}
                text={t("servers.fileManager.selection.deleteConfirm", { count: selectedItems.length })}
            />

            <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={contextMenu.close} trigger={contextMenu.triggerRef}>
                <ContextMenuItem icon={mdiFormTextbox} label={t("servers.fileManager.contextMenu.rename")} onClick={() => startRename(selectedItem)} />
                {selectedItem?.type === "file" && (
                    <>
                        {isPreviewable(selectedItem.name) && (
                            <ContextMenuItem icon={mdiEye} label={t("servers.fileManager.contextMenu.preview")} onClick={handlePreview} />
                        )}
                        <ContextMenuItem icon={mdiTextBoxEdit} label={t("servers.fileManager.contextMenu.edit")} onClick={openFile} />
                    </>
                )}
                <ContextMenuItem icon={mdiFileDownload} label={t("servers.fileManager.contextMenu.download")} onClick={handleDownload} />
                <ContextMenuItem icon={mdiTrashCan} label={t("servers.fileManager.contextMenu.delete")} onClick={handleDeleteClick} danger />
            </ContextMenu>
        </div>
    );
});
