import Icon from "@mdi/react";
import { mdiDomain, mdiDomainOff } from "@mdi/js";
import ServerEntries from "../ServerEntries.jsx";
import { useContext, useEffect, useRef, useState } from "react";
import { patchRequest } from "@/common/utils/RequestUtil.js";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { getFolderState, setFolderState } from "@/common/utils/folderState";
import { useDrop } from "react-dnd";
import { useMove } from "../../useMove.js";

const OrganizationFolder = ({ id, name, entries, nestedLevel, connectToServer, connectToPVEServer, renameState, setRenameStateId, hibernatedSessions = [] }) => {
    const move = useMove();
    const [isOpen, setIsOpen] = useState(() => getFolderState(id, true));
    
    const toggleFolder = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        setFolderState(id, newState);
    };
    const orgId = id.split('-')[1];

    const { loadServers } = useContext(ServerContext);
    const inputRef = useRef();
    useEffect(() => {
        if (!renameState) return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [renameState]);

    const changeName = async () => {
        const newName = (inputRef.current?.value || "").trim();
        try {
            if (newName && newName !== name) {
                await patchRequest("organizations/" + orgId, { name: newName });
                await loadServers();
            }
        } catch (error) {
            console.error("Failed to rename organization", error.message);
        } finally {
            setRenameStateId(null);
        }
    };

    const handleRenameKey = (e) => {
        if (e.key === "Enter") inputRef.current?.blur();
    };

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        canDrop: (item) => !item.isIntegrationEntry,
        drop: async (item) => {
            try {
                if (item.type === "server") {
                    await move(`entries/${item.id}/reposition`, {
                        targetId: null,
                        placement: 'after',
                        folderId: null,
                        organizationId: Number.parseInt(orgId),
                    });
                    return { id: orgId };
                }

                if (item.type === "folder") {
                    await move(`folders/${item.id}`, {
                        parentId: null,
                        organizationId: Number.parseInt(orgId),
                    });
                    return { id: orgId };
                }
            } catch (error) {
                console.error("Failed to drop item into organization", error.message);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver() && monitor.canDrop(),
        }),
    });

    return (
        <>
            <div className={"folder-object" + (isOver ? " folder-is-over" : "")}
                 onClick={renameState ? (e) => e.stopPropagation() : toggleFolder} data-id={id}
                 style={{ paddingLeft: `${10 + (nestedLevel * 15)}px` }}
                 ref={dropRef}>
                <Icon path={isOpen ? mdiDomain : mdiDomainOff} />
                {!renameState && <p className="truncate-text">{name}</p>}
                {renameState && <input type="text" ref={inputRef} defaultValue={name} maxLength={100}
                                       onBlur={changeName} onKeyDown={handleRenameKey} />}
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
