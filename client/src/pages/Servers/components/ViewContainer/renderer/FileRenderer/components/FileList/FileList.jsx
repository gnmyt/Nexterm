import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import "./styles.sass";
import Icon from "@mdi/react";
import {
    mdiFile, mdiFolder, mdiAlertCircle, mdiFormTextbox, mdiTextBoxEdit,
    mdiFileDownload, mdiTrashCan, mdiEye, mdiFileMove, mdiContentCopy,
    mdiInformationOutline, mdiConsole,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";
import { useTranslation } from "react-i18next";
import { usePreferences } from "@/common/contexts/PreferencesContext.jsx";
import SelectionActionBar from "../SelectionActionBar";
import FileItem from "./components/FileItem";
import PropertiesDialog from "./components/PropertiesDialog";
import { useBoxSelection, useDragDrop, useKeyboardNavigation, useClipboard } from "./hooks";
import { isPreviewable, getFullPath, OPERATIONS } from "./utils/fileUtils";

export const FileList = forwardRef(({
    items, updatePath, path, sendOperation, downloadFile, downloadMultipleFiles,
    setCurrentFile, setPreviewFile, loading, viewMode = "list", error,
    resolveSymlink, session, createFile, createFolder, moveFiles, copyFiles, isActive,
    onOpenTerminal, onPropertiesMessage,
}, ref) => {
    const { t } = useTranslation();
    const { showThumbnails, showHiddenFiles, confirmBeforeDelete, dragDropAction } = usePreferences();
    
    const [selectedItem, setSelectedItem] = useState(null);
    const [renamingItem, setRenamingItem] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [creatingFile, setCreatingFile] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [bigFileDialogOpen, setBigFileDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [massDeleteDialogOpen, setMassDeleteDialogOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
    const [propertiesItem, setPropertiesItem] = useState(null);
    
    const containerRef = useRef(null);
    const itemRefs = useRef({});
    const contextMenu = useContextMenu();
    const emptyContextMenu = useContextMenu();
    const dropMenu = useContextMenu();

    useImperativeHandle(ref, () => ({
        startCreateFolder: () => { setCreatingFolder(true); setNewFolderName(""); },
        startCreateFile: () => { setCreatingFile(true); setNewFileName(""); },
    }));

    const filteredItems = useMemo(() => {
        const filtered = showHiddenFiles ? items : items.filter(item => !item.name.startsWith("."));
        return [...filtered].sort((a, b) => b.type.localeCompare(a.type) || a.name.localeCompare(b.name));
    }, [items, showHiddenFiles]);

    useEffect(() => setSelectedItems([]), [path]);

    useEffect(() => {
        if (selectedItem) {
            const updated = items.find(i => i.name === selectedItem.name && i.type === selectedItem.type);
            if (updated && updated.mode !== selectedItem.mode) {
                setSelectedItem(updated);
            }
        }
    }, [items, selectedItem]);

    const isItemSelected = useCallback((item) => (
        selectedItems.some(s => s.name === item.name && s.type === item.type)
    ), [selectedItems]);

    const handleClick = useCallback((item) => {
        const fullPath = getFullPath(path, item.name);
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
    }, [path, resolveSymlink, updatePath, setPreviewFile, setCurrentFile, downloadFile]);

    const { handleCopy, handleCut, handlePaste, isItemCut } = useClipboard({
        selectedItems, selectedItem, path, copyFiles, moveFiles,
    });

    const contextMenuOpen = contextMenu.isOpen || emptyContextMenu.isOpen || dropMenu.isOpen;

    const { focusedIndex } = useKeyboardNavigation({
        isActive, filteredItems, selectedItems, setSelectedItems, itemRefs,
        renamingItem, creatingFolder, creatingFile, contextMenuOpen,
        handleCopy, handleCut, handlePaste, handleClick,
    });

    const { isSelecting, selectionBox, handleSelectionStart } = useBoxSelection({
        containerRef, itemRefs, filteredItems, onSelectionChange: setSelectedItems,
    });

    const {
        draggedItems, dropTarget, dragImageRef,
        handleDragStart, handleDragEnd, handleDragOver, handleDragLeave,
        handleDrop, handleContainerDrop, handleDropAction, setPendingDrop,
    } = useDragDrop({
        path, sessionId: session.id, selectedItems, isItemSelected,
        moveFiles, copyFiles, dragDropAction, updatePath,
    });

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
            sendOperation(item.type === "folder" ? OPERATIONS.DELETE_FOLDER : OPERATIONS.DELETE_FILE, { path: `${path}/${item.name}` });
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

    const handleDelete = () => sendOperation(selectedItem.type === "folder" ? OPERATIONS.DELETE_FOLDER : OPERATIONS.DELETE_FILE, { path: `${path}/${selectedItem?.name}` });
    const handleDeleteClick = () => confirmBeforeDelete ? setDeleteDialogOpen(true) : handleDelete();
    const handleRename = (item, newName) => { if (newName && newName !== item.name) sendOperation(OPERATIONS.RENAME_FILE, { path: `${path}/${item.name}`, newPath: `${path}/${newName}` }); setRenamingItem(null); };
    const startRename = (item) => { setRenamingItem(item); setRenameValue(item.name); };
    const handleRenameKeyDown = (e, item) => e.key === 'Enter' ? (e.preventDefault(), handleRename(item, renameValue)) : e.key === 'Escape' && setRenamingItem(null);
    const handleCreateFolder = () => { if (newFolderName.trim()) createFolder(newFolderName.trim()); setCreatingFolder(false); };
    const handleCreateFolderKeyDown = (e) => e.key === 'Enter' ? (e.preventDefault(), handleCreateFolder()) : e.key === 'Escape' && setCreatingFolder(false);
    const handleCreateFile = () => { if (newFileName.trim()) createFile(newFileName.trim()); setCreatingFile(false); };
    const handleCreateFileKeyDown = (e) => e.key === 'Enter' ? (e.preventDefault(), handleCreateFile()) : e.key === 'Escape' && setCreatingFile(false);
    const openFile = () => selectedItem?.size >= 1024 * 1024 ? setBigFileDialogOpen(true) : setCurrentFile(`${path}/${selectedItem?.name}`);
    const handlePropertiesClick = (item = null) => { setPropertiesItem(item); setPropertiesDialogOpen(true); };
    const handleEmptyContextMenu = (e) => { if (e.target.closest('.file-item')) return; e.preventDefault(); emptyContextMenu.open(e, { x: e.pageX, y: e.pageY }); };
    const handleOpenTerminal = (targetPath = null) => onOpenTerminal?.(targetPath || path);

    return (
        <div className={`file-list ${viewMode}`}>
            {viewMode === "list" && (
                <div className="file-list-header">
                    <div className="header-name">{t("servers.fileManager.header.name")}</div>
                    <div className="header-size">{t("servers.fileManager.header.size")}</div>
                    <div className="header-permissions">{t("servers.fileManager.header.permissions")}</div>
                    <div className="header-date">{t("servers.fileManager.header.modified")}</div>
                    <div className="header-actions"></div>
                </div>
            )}
            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>{t("servers.fileManager.states.loading")}</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <Icon path={mdiAlertCircle} />
                    <h3>{t("servers.fileManager.states.accessDenied")}</h3>
                    <p>{error}</p>
                </div>
            ) : filteredItems.length === 0 && !creatingFolder && !creatingFile ? (
                <div className="empty-state">
                    <Icon path={mdiFolder} />
                    <h3>{t("servers.fileManager.states.emptyFolder")}</h3>
                    <p>{t("servers.fileManager.states.dropFilesHint")}</p>
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
                    onContextMenu={handleEmptyContextMenu}
                    onDragOver={(e) => e.dataTransfer.types.includes("application/x-sftp-files") && e.preventDefault()}
                    onDrop={(e) => handleContainerDrop(e, clearSelection, (ev) => dropMenu.open(ev, { x: ev.clientX, y: ev.clientY }))}
                >
                    {isSelecting && selectionBox && (
                        <div className="selection-box" style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }} />
                    )}
                    {creatingFile && (
                        <div className={`file-item ${viewMode} new-file`} onMouseDown={(e) => e.stopPropagation()}>
                            <div className="file-name">
                                <Icon path={mdiFile} />
                                <input type="text" className="rename-input" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={handleCreateFileKeyDown} onBlur={handleCreateFile} placeholder={t("servers.fileManager.createFile.placeholder")} autoFocus />
                            </div>
                            {viewMode === "list" && <><p className="file-size"></p><p className="file-date"></p></>}
                        </div>
                    )}
                    {creatingFolder && (
                        <div className={`file-item ${viewMode} new-folder`} onMouseDown={(e) => e.stopPropagation()}>
                            <div className="file-name">
                                <Icon path={mdiFolder} />
                                <input type="text" className="rename-input" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={handleCreateFolderKeyDown} onBlur={handleCreateFolder} placeholder={t("servers.fileManager.createFolder.placeholder")} autoFocus />
                            </div>
                            {viewMode === "list" && <><p className="file-size"></p><p className="file-date"></p></>}
                        </div>
                    )}
                    {filteredItems.map((item, index) => (
                        <FileItem
                            key={item.name}
                            item={item}
                            viewMode={viewMode}
                            path={path}
                            session={session}
                            isSelected={isItemSelected(item)}
                            isFocused={focusedIndex === index}
                            isRenaming={renamingItem?.name === item.name}
                            isBeingDragged={draggedItems.some(d => d.name === item.name)}
                            isDropTarget={dropTarget === item.name}
                            isCut={isItemCut(`${path}/${item.name}`)}
                            showThumbnails={showThumbnails}
                            renameValue={renameValue}
                            onRenameChange={(e) => setRenameValue(e.target.value)}
                            onRenameKeyDown={(e) => handleRenameKeyDown(e, item)}
                            onRenameBlur={() => handleRename(item, renameValue)}
                            onClick={(e) => renamingItem?.name !== item.name && handleItemClick(e, item)}
                            onContextMenu={(e) => handleContextMenu(e, item)}
                            onDotsClick={(e) => { e.stopPropagation(); handleContextMenu(e, item, true); }}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, item)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, item, clearSelection, (ev) => dropMenu.open(ev, { x: ev.clientX, y: ev.clientY }))}
                            itemRef={(el) => itemRefs.current[item.name] = el}
                        />
                    ))}
                </div>
            )}

            <SelectionActionBar selectedItems={selectedItems} onClearSelection={clearSelection} onDownload={handleMassDownload} onDelete={handleMassDelete} containerRef={containerRef} />

            <ActionConfirmDialog open={bigFileDialogOpen} setOpen={setBigFileDialogOpen} onConfirm={() => setCurrentFile(`${path}/${selectedItem?.name}`)} text={t("servers.fileManager.contextMenu.bigFileConfirm", { size: Math.round(selectedItem?.size / 1024 / 1024) })} />
            <ActionConfirmDialog open={deleteDialogOpen} setOpen={setDeleteDialogOpen} onConfirm={handleDelete} text={t("servers.fileManager.contextMenu.deleteConfirm", { name: selectedItem?.name })} />
            <ActionConfirmDialog open={massDeleteDialogOpen} setOpen={setMassDeleteDialogOpen} onConfirm={executeMassDelete} text={t("servers.fileManager.selection.deleteConfirm", { count: selectedItems.length })} />

            <PropertiesDialog
                open={propertiesDialogOpen}
                onClose={() => setPropertiesDialogOpen(false)}
                item={propertiesItem}
                path={path}
                sendOperation={sendOperation}
                OPERATIONS={OPERATIONS}
                onRegisterHandler={onPropertiesMessage}
            />

            <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={contextMenu.close} trigger={contextMenu.triggerRef}>
                <ContextMenuItem icon={mdiFormTextbox} label={t("servers.fileManager.contextMenu.rename")} onClick={() => startRename(selectedItem)} />
                {selectedItem?.type === "file" && (
                    <>
                        {isPreviewable(selectedItem.name) && <ContextMenuItem icon={mdiEye} label={t("servers.fileManager.contextMenu.preview")} onClick={() => setPreviewFile?.(`${path}/${selectedItem.name}`)} />}
                        <ContextMenuItem icon={mdiTextBoxEdit} label={t("servers.fileManager.contextMenu.edit")} onClick={openFile} />
                    </>
                )}
                <ContextMenuItem icon={mdiFileDownload} label={t("servers.fileManager.contextMenu.download")} onClick={() => downloadFile(`${path}/${selectedItem?.name}`)} />
                <ContextMenuItem icon={mdiInformationOutline} label={t("servers.fileManager.contextMenu.properties")} onClick={() => handlePropertiesClick(selectedItem)} />
                {selectedItem?.type === "folder" && (
                    <ContextMenuItem icon={mdiConsole} label={t("servers.fileManager.contextMenu.openTerminal")} onClick={() => handleOpenTerminal(`${path}/${selectedItem.name}`)} />
                )}
                <ContextMenuItem icon={mdiTrashCan} label={t("servers.fileManager.contextMenu.delete")} onClick={handleDeleteClick} danger />
            </ContextMenu>

            <ContextMenu isOpen={emptyContextMenu.isOpen} position={emptyContextMenu.position} onClose={emptyContextMenu.close} trigger={emptyContextMenu.triggerRef}>
                <ContextMenuItem icon={mdiFileDownload} label={t("servers.fileManager.contextMenu.downloadFolder")} onClick={() => downloadFile(path)} />
                <ContextMenuItem icon={mdiInformationOutline} label={t("servers.fileManager.contextMenu.properties")} onClick={() => handlePropertiesClick(null)} />
                <ContextMenuItem icon={mdiConsole} label={t("servers.fileManager.contextMenu.openTerminal")} onClick={() => handleOpenTerminal()} />
            </ContextMenu>

            <ContextMenu isOpen={dropMenu.isOpen} position={dropMenu.position} onClose={() => { dropMenu.close(); setPendingDrop(null); }}>
                <ContextMenuItem icon={mdiFileMove} label={t("servers.fileManager.contextMenu.moveHere")} onClick={() => handleDropAction("move", clearSelection, dropMenu.close)} />
                <ContextMenuItem icon={mdiContentCopy} label={t("servers.fileManager.contextMenu.copyHere")} onClick={() => handleDropAction("copy", clearSelection, dropMenu.close)} />
            </ContextMenu>

            <div className="drag-preview" ref={dragImageRef}>
                <div className="drag-icons"><div className="drag-badge"></div></div>
            </div>
        </div>
    );
});
