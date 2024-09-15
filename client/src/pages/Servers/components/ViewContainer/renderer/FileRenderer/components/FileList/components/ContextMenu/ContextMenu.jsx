import React, { useState } from "react";
import Icon from "@mdi/react";
import { mdiFileDownload, mdiFormTextbox, mdiTrashCan } from "@mdi/js";
import RenameItemDialog from "../RenameItemDialog";

export const ContextMenu = ({ menuPosition, selectedItem, closeContextMenu, sendOperation, path, downloadFile }) => {

    const [renameDialogOpen, setRenameDialogOpen] = useState(false);

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

    return (
        <>
            <RenameItemDialog open={renameDialogOpen} closeDialog={() => setRenameDialogOpen(false)} renameItem={handleRename}
                                item={selectedItem}/>
            {menuPosition.x !== 0 && menuPosition.y !== 0 &&
                <div className="context-menu" style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}>
                    <div className="context-item" onClick={() => setRenameDialogOpen(true)}>
                        <Icon path={mdiFormTextbox} />
                        <p>Rename</p>
                    </div>
                    {selectedItem.type === "file" && (
                        <div className="context-item" onClick={() => handleDownload()}>
                            <Icon path={mdiFileDownload} />
                            <p>Download</p>
                        </div>
                    )}
                    <div className="context-item" onClick={() => handleDelete()}>
                        <Icon path={mdiTrashCan} />
                        <p>Delete</p>
                    </div>
                </div>}
        </>
    );
};