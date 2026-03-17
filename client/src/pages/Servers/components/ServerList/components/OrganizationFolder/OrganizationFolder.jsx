import Icon from "@mdi/react";
import { mdiDomain, mdiDomainOff } from "@mdi/js";
import ServerEntries from "../ServerEntries.jsx";
import { useContext, useState } from "react";
import { getFolderState, setFolderState } from "@/common/utils/folderState";
import { useDrop } from "react-dnd";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";

const OrganizationFolder = ({ id, name, entries, nestedLevel, connectToServer, connectToPVEServer, setRenameStateId, hibernatedSessions = [] }) => {
    const { loadServers } = useContext(ServerContext);
    const [isOpen, setIsOpen] = useState(() => getFolderState(id, true));
    
    const toggleFolder = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        setFolderState(id, newState);
    };
    const orgId = id.split('-')[1];

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        drop: async (item) => {
            try {
                if (item.type === "server") {
                    await patchRequest(`entries/${item.id}/reposition`, { 
                        targetId: null,
                        placement: 'after',
                        folderId: null,
                        organizationId: parseInt(orgId)
                    });
                    loadServers();
                    return { id: orgId };
                }

                if (item.type === "folder") {
                    await patchRequest(`folders/${item.id}`, { 
                        parentId: null,
                        organizationId: parseInt(orgId)
                    });
                    loadServers();
                    return { id: orgId };
                }
            } catch (error) {
                console.error("Failed to drop item into organization", error.message);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

    return (
        <>
            <div className={"folder-object" + (isOver ? " folder-is-over" : "")} onClick={toggleFolder} data-id={id}
                 style={{ paddingLeft: `${10 + (nestedLevel * 15)}px` }}
                 ref={dropRef}>
                <Icon path={isOpen ? mdiDomain : mdiDomainOff} />
                <p className="truncate-text">{name}</p>
            </div>
            {isOpen && (
                <ServerEntries
                    entries={entries}
                    nestedLevel={nestedLevel + 1}
                    setRenameStateId={setRenameStateId}
                    folderId={null}
                    organizationId={parseInt(orgId)}
                    connectToServer={connectToServer}
                    connectToPVEServer={connectToPVEServer}
                    hibernatedSessions={hibernatedSessions}
                />
            )}
        </>
    );
};

export default OrganizationFolder;