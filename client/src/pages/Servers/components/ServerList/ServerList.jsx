import "./styles.sass";
import ServerSearch from "./components/ServerSearch";
import { useContext, useEffect, useState } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import ServerEntries from "./components/ServerEntries.jsx";
import Icon from "@mdi/react";
import { mdiCursorDefaultClick } from "@mdi/js";
import ContextMenu from "./components/ContextMenu";

const filterEntries = (entries, searchTerm) => {
    return entries
        .map(entry => {
            if (entry.type === "folder") {
                const filteredEntries = filterEntries(entry.entries, searchTerm);
                if (filteredEntries.length > 0) {
                    return { ...entry, entries: filteredEntries };
                }
            } else if (entry.type === "server") {
                if (entry.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return entry;
                }
            }
            return null;
        })
        .filter(entry => entry !== null);
};

const applyRenameState = (folderId) => (entry) => {
    if (entry.type === "folder" && entry.id === parseInt(folderId)) {
        return { ...entry, renameState: true };
    } else if (entry.type === "folder" && entry.entries) {
        return { ...entry, entries: entry.entries.map(applyRenameState(folderId)) };
    }
    return entry;
};

export const ServerList = ({
                               setServerDialogOpen, setCurrentFolderId, setProxmoxDialogOpen,
                               setEditServerId, connectToServer, connectToPVEServer,
                           }) => {
    const { servers } = useContext(ServerContext);
    const [search, setSearch] = useState("");
    const [contextMenuPosition, setContextMenuPosition] = useState(null);

    const [contextClickedType, setContextClickedType] = useState(null);
    const [contextClickedId, setContextClickedId] = useState(null);

    const [renameStateId, setRenameStateId] = useState(null);

    const filteredServers = search ? filterEntries(servers, search) : servers;
    const renameStateServers = renameStateId ? filteredServers.map(applyRenameState(renameStateId)) : filteredServers;

    const handleContextMenu = (e) => {
        e.preventDefault();

        const targetElement = e.target.closest("[data-id]");

        if (targetElement !== null) {
            setContextClickedId(targetElement.getAttribute("data-id"));
            setContextClickedType(targetElement.classList[0]);
        } else {
            setContextClickedId(null);
            setContextClickedType(null);
        }

        setContextMenuPosition({ x: e.pageX, y: e.pageY });
    };

    const handleClick = () => {
        setContextClickedId(null);
        setContextClickedType(null);
        setContextMenuPosition(null);
    };

    useEffect(() => {
        document.addEventListener("click", handleClick);
        return () => {
            document.removeEventListener("click", handleClick);
        };
    }, []);

    return (
        <div className="server-list">
            <div className="server-list-inner">
                <ServerSearch search={search} setSearch={setSearch} />
                {servers && servers.length >= 1 && (
                    <div className="servers" onContextMenu={handleContextMenu}>
                        <ServerEntries entries={renameStateServers} setRenameStateId={setRenameStateId}
                                       nestedLevel={0} connectToServer={connectToServer}
                                       connectToPVEServer={connectToPVEServer} />
                    </div>
                )}
                {servers && servers.length === 0 && (
                    <div className="no-servers" onContextMenu={handleContextMenu}>
                        <Icon path={mdiCursorDefaultClick} />
                        <p>Right-click to add a new server</p>
                    </div>
                )}
                {contextMenuPosition && (
                    <ContextMenu position={contextMenuPosition} type={contextClickedType} id={contextClickedId}
                                 setRenameStateId={setRenameStateId} setServerDialogOpen={setServerDialogOpen}
                                 setCurrentFolderId={setCurrentFolderId} setEditServerId={setEditServerId}
                                 setProxmoxDialogOpen={setProxmoxDialogOpen}
                                 connectToServer={connectToServer} connectToPVEServer={connectToPVEServer} />
                )}
            </div>
        </div>
    );
};
