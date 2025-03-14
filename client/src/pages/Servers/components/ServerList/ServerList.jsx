import "./styles.sass";
import ServerSearch from "./components/ServerSearch";
import { useContext, useEffect, useState, useRef } from "react";
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
                               setEditServerId, connectToServer, connectToPVEServer, openSFTP,
                           }) => {
    const { servers } = useContext(ServerContext);
    const [search, setSearch] = useState("");
    const [contextMenuPosition, setContextMenuPosition] = useState(null);
    const [contextClickedType, setContextClickedType] = useState(null);
    const [contextClickedId, setContextClickedId] = useState(null);
    const [renameStateId, setRenameStateId] = useState(null);
    const [width, setWidth] = useState(288);
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const serverListRef = useRef(null);

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

    const startResizing = (e) => {
        e.preventDefault();

        if (isCollapsed) {
            setIsCollapsed(false);
            setWidth(288);
            return;
        }

        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (e) => {
        if (isResizing) {
            const newWidth = e.clientX - serverListRef.current.getBoundingClientRect().left;

            if (newWidth <= 180) {
                setIsCollapsed(true);
                setWidth(0);
            } else {
                setIsCollapsed(false);
                setWidth(newWidth);
            }
        }
    };

    useEffect(() => {
        document.addEventListener("click", handleClick);

        if (isResizing) {
            document.addEventListener("mousemove", resize);
            document.addEventListener("mouseup", stopResizing);
        }

        return () => {
            document.removeEventListener("click", handleClick);
            document.removeEventListener("mousemove", resize);
            document.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing]);

    return (
        <div
            className={`server-list ${isCollapsed ? "collapsed" : ""}`}
            style={{ width: isCollapsed ? "0px" : `${width}px` }} ref={serverListRef}
            onMouseDown={isCollapsed ? startResizing : undefined}>
            {!isCollapsed && (
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
                                     setProxmoxDialogOpen={setProxmoxDialogOpen} openSFTP={openSFTP}
                                     connectToServer={connectToServer} connectToPVEServer={connectToPVEServer} />
                    )}
                </div>
            )}
            <div className={`resizer${isResizing ? " is-resizing" : ""}`} onMouseDown={startResizing} />
        </div>
    );
};
