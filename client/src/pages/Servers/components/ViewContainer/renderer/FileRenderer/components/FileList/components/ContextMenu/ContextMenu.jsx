import React, { useContext } from "react";
import Icon from "@mdi/react";
import { mdiFileDownload, mdiFormTextbox, mdiTrashCan } from "@mdi/js";
import { UserContext } from "@/common/contexts/UserContext.jsx";

export const ContextMenu = ({ menuPosition, selectedItem, closeContextMenu, sendOperation, path, serverId, identityId }) => {

    const {sessionToken} = useContext(UserContext);

    const handleDelete = () => {
        sendOperation(selectedItem.type === "folder" ? 0x7 : 0x6, { path: path + "/" + selectedItem.name });

        closeContextMenu();
    };

    const handleDownload = () => {
        const url = `/api/servers/sftp-download?serverId=${serverId}&identityId=${identityId}&path=${path}/${selectedItem.name}&sessionToken=${sessionToken}`;

        const link = document.createElement("a");
        link.href = url;
        link.download = selectedItem.name;
        document.body.appendChild(link);
        link.click();

        closeContextMenu();
    }

    const handleRename = () => {
        console.log("Rename");
    };

    return (
        <div className="context-menu" style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}>
            <div className="context-item" onClick={() => handleRename()}>
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
        </div>
    );
};