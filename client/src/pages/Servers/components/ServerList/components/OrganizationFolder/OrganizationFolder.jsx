import Icon from "@mdi/react";
import { mdiDomain, mdiDomainOff } from "@mdi/js";
import ServerEntries from "../ServerEntries.jsx";
import { useState } from "react";
import { getFolderState, setFolderState } from "@/common/utils/folderState";

const OrganizationFolder = ({ id, name, entries, nestedLevel, connectToServer, connectToPVEServer, setRenameStateId, sshOnly }) => {
    const [isOpen, setIsOpen] = useState(() => getFolderState(id, true));
    
    const toggleFolder = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        setFolderState(id, newState);
    };
    const orgId = id.split('-')[1];

    return (
        <>
            <div className="folder-object" onClick={toggleFolder} data-id={id}
                 style={{ paddingLeft: `${10 + (nestedLevel * 15)}px` }}>
                <Icon path={isOpen ? mdiDomain : mdiDomainOff} />
                <p className="truncate-text">{name}</p>
            </div>
            {isOpen && (
                <ServerEntries
                    entries={entries}
                    nestedLevel={nestedLevel + 1}
                    setRenameStateId={setRenameStateId}
                    folderId={`org-${orgId}`}
                    connectToServer={connectToServer}
                    connectToPVEServer={connectToPVEServer}
                    sshOnly={sshOnly}
                />
            )}
        </>
    );
};

export default OrganizationFolder;