import React, { useState } from "react";
import Icon from "@mdi/react";
import { mdiFileDownload, mdiFormTextbox, mdiTextBoxEdit, mdiTrashCan } from "@mdi/js";
import RenameItemDialog from "../RenameItemDialog";
import { ActionConfirmDialog } from "@/common/components/ActionConfirmDialog/ActionConfirmDialog.jsx";

export const ContextMenu = ({ menuPosition, selectedItem, closeContextMenu, sendOperation, path, downloadFile, setCurrentFile }) => {

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
                                 text={`This file is ${Math.round(selectedItem?.size / 1024 / 1024)} MB large. Are you sure you want to edit it?`}/>
            {menuPosition.x !== 0 && menuPosition.y !== 0 &&
                <div className="context-menu" style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}>
                    <div className="context-item" onClick={() => setRenameDialogOpen(true)}>
                        <Icon path={mdiFormTextbox} />
                        <p>Rename</p>
                    </div>
                    {selectedItem.type === "file" && (
                        <>
                            <div className="context-item" onClick={() => openFile()}>
                                <Icon path={mdiTextBoxEdit} />
                                <p>Edit</p>
                            </div>
                            <div className="context-item" onClick={() => handleDownload()}>
                                <Icon path={mdiFileDownload} />
                                <p>Download</p>
                            </div>
                        </>
                    )}
                    <div className="context-item" onClick={() => handleDelete()}>
                        <Icon path={mdiTrashCan} />
                        <p>Delete</p>
                    </div>
                </div>}
        </>
    );
};