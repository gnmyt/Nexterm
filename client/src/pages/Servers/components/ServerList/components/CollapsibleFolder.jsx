import FolderObject from "@/pages/Servers/components/ServerList/components/FolderObject";
import ServerEntries from "./ServerEntries.jsx";
import { useState } from "react";
import { getFolderState, setFolderState } from "@/common/utils/folderState";

const CollapsibleFolder = ({ id, name, entries, nestedLevel, renameState, setRenameStateId, connectToServer, connectToPVEServer, sshOnly }) => {
    const [isOpen, setIsOpen] = useState(() => getFolderState(id, true));
    
    const toggleFolder = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        setFolderState(id, newState);
    };

    return (
        <>
            <FolderObject id={id} name={name} nestedLevel={nestedLevel} onClick={toggleFolder}
                isOpen={isOpen} renameState={renameState} setRenameStateId={setRenameStateId} />
            {isOpen && (
                <ServerEntries entries={entries} nestedLevel={nestedLevel + 1} setRenameStateId={setRenameStateId} folderId={id}
                    connectToServer={connectToServer} connectToPVEServer={connectToPVEServer} sshOnly={sshOnly} />
            )}
        </>
    );
};

export default CollapsibleFolder;