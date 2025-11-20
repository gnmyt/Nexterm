import "./styles.sass";
import ServerSearch from "./components/ServerSearch";
import { useContext, useEffect, useState, useRef } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import ServerEntries from "./components/ServerEntries.jsx";
import Icon from "@mdi/react";
import { mdiCursorDefaultClick } from "@mdi/js";
import ContextMenu from "./components/ContextMenu";
import { useDrop } from "react-dnd";
import { patchRequest } from "@/common/utils/RequestUtil.js";

const filterEntries = (entries, searchTerm) => {
    return entries
        .map(entry => {
            if (entry.type === "folder" || entry.type === "organization") {
                const filteredEntries = filterEntries(entry.entries, searchTerm);
                if (filteredEntries.length > 0 ||
                    entry.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    return { ...entry, entries: filteredEntries };
                }
            } else if (entry.type === "server") {
                const nameMatch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
                const ipMatch = entry.ip && entry.ip.toLowerCase().includes(searchTerm.toLowerCase());
                if (nameMatch || ipMatch) {
                    return entry;
                }
            } else if (entry.type.startsWith("pve-")) {
                const nameMatch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
                const ipMatch = entry.ip && entry.ip.toLowerCase().includes(searchTerm.toLowerCase());

                if (nameMatch || ipMatch) {
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
    } else if ((entry.type === "folder" || entry.type === "organization") && entry.entries) {
        return { ...entry, entries: entry.entries.map(applyRenameState(folderId)) };
    }
    return entry;
};

export const ServerList = ({
                               setServerDialogOpen, setCurrentFolderId, setProxmoxDialogOpen, setSSHConfigImportDialogOpen,
                               setEditServerId, connectToServer, openSFTP,
                           }) => {
    const { servers, loadServers } = useContext(ServerContext);
    const [search, setSearch] = useState("");
    const [contextMenuPosition, setContextMenuPosition] = useState(null);
    const [contextClickedType, setContextClickedType] = useState(null);
    const [contextClickedId, setContextClickedId] = useState(null);
    const [renameStateId, setRenameStateId] = useState(null);
    const [width, setWidth] = useState(288);
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const serverListRef = useRef(null);

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        drop: async (item) => {
            try {
                if (item.type === "server") {
                    await patchRequest("entries/" + item.id, { folderId: null });
                    loadServers();
                    return {};
                }

                if (item.type === "folder") {
                    await patchRequest(`folders/${item.id}`, { parentId: null });
                    loadServers();
                    return {};
                }
            } catch (error) {
                console.error("Failed to drop item at root level", error.message);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    });

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

        const position = calculateContextMenuPosition(e.clientX, e.clientY);
        setContextMenuPosition(position);
    };

    const calculateContextMenuPosition = (x, y) => {
        requestAnimationFrame(() => {
            if (!contextMenuPosition) return;

            const menu = document.querySelector('.context-menu');
            if (!menu) return;

            const menuRect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let adjustedX = x;
            let adjustedY = y;

            if (x + menuRect.width > viewportWidth) adjustedX = viewportWidth - menuRect.width - 10;
            if (y + menuRect.height > viewportHeight) adjustedY = viewportHeight - menuRect.height - 10;

            if (adjustedX !== contextMenuPosition.x || adjustedY !== contextMenuPosition.y) {
                setContextMenuPosition({ x: adjustedX, y: adjustedY });
            }
        });

        return { x, y };
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
                <div className="server-list-inner" ref={dropRef}>
                    <ServerSearch search={search} setSearch={setSearch} />
                    {servers && servers.length >= 1 && (
                        <div className={`servers${isOver ? " drop-zone-active" : ""}`} onContextMenu={handleContextMenu}>
                            <ServerEntries entries={renameStateServers} setRenameStateId={setRenameStateId}
                                           nestedLevel={0} connectToServer={connectToServer} />
                        </div>
                    )}
                    {servers && servers.length === 0 && (
                        <div className={`no-servers${isOver ? " drop-zone-active" : ""}`} onContextMenu={handleContextMenu}>
                            <Icon path={mdiCursorDefaultClick} />
                            <p>Right-click to add a new server</p>
                        </div>
                    )}
                    {contextMenuPosition && (
                        <ContextMenu position={contextMenuPosition} type={contextClickedType} id={contextClickedId}
                                     setRenameStateId={setRenameStateId} setServerDialogOpen={setServerDialogOpen}
                                     setCurrentFolderId={setCurrentFolderId} setEditServerId={setEditServerId}
                                     setProxmoxDialogOpen={setProxmoxDialogOpen} setSSHConfigImportDialogOpen={setSSHConfigImportDialogOpen}
                                     openSFTP={openSFTP}
                                     connectToServer={connectToServer} />
                    )}
                </div>
            )}
            <div className={`resizer${isResizing ? " is-resizing" : ""}`} onMouseDown={startResizing} />
        </div>
    );
};
