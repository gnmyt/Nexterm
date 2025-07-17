import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiFileDownload, mdiFormTextbox, mdiTextBoxEdit, mdiTrashCan } from "@mdi/js";
import RenameItemDialog from "../RenameItemDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";

export const ContextMenu = ({ menuPosition, selectedItem, closeContextMenu, sendOperation, path, downloadFile, setCurrentFile }) => {
    const { t } = useTranslation();
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [bigFileDialogOpen, setBigFileDialogOpen] = useState(false);

    const handleDelete = () => {
        sendOperation(selectedItem.type === "folder" ? 0x7 : 0x6, { path: path + "/" + selectedItem.name });

        closeContextMenu();
    };

    const handleDownload = () => {
        downloadFile(path + "/" + selectedItem.name);

        closeContextMenu();
    }

    const handleRename = (newName) => {
        sendOperation(0x8, { path: path + "/" + selectedItem.name, newPath: path + "/" + newName });

        closeContextMenu();
    }

    const openFile = () => {
        if (selectedItem.type === "file" && selectedItem.size >= 1024 * 1024) {
            setBigFileDialogOpen(true);
        } else {
            setCurrentFile(path + "/" + selectedItem.name);
        }
    }

    return (
        <>
            <RenameItemDialog open={renameDialogOpen} closeDialog={() => setRenameDialogOpen(false)} renameItem={handleRename}
                                item={selectedItem}/>
            <ActionConfirmDialog open={bigFileDialogOpen} setOpen={setBigFileDialogOpen}
                                 onConfirm={() => setCurrentFile(path + "/" + selectedItem?.name)}
                                 text={t('servers.fileManager.contextMenu.bigFileConfirm', { size: Math.round(selectedItem?.size / 1024 / 1024) })}/>
            {menuPosition.x !== 0 && menuPosition.y !== 0 &&
                <div className="context-menu" style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}>
                    <div className="context-item" onClick={() => setRenameDialogOpen(true)}>
                        <Icon path={mdiFormTextbox} />
                        <p>{t('servers.fileManager.contextMenu.rename')}</p>
                    </div>
                    {selectedItem.type === "file" && (
                        <>
                            <div className="context-item" onClick={() => openFile()}>
                                <Icon path={mdiTextBoxEdit} />
                                <p>{t('servers.fileManager.contextMenu.edit')}</p>
                            </div>
                            <div className="context-item" onClick={() => handleDownload()}>
                                <Icon path={mdiFileDownload} />
                                <p>{t('servers.fileManager.contextMenu.download')}</p>
                            </div>
                        </>
                    )}
                    <div className="context-item" onClick={() => handleDelete()}>
                        <Icon path={mdiTrashCan} />
                        <p>{t('servers.fileManager.contextMenu.delete')}</p>
                    </div>
                </div>}
        </>
    );
};