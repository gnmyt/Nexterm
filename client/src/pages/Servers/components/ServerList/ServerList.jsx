import "./styles.sass";
import ServerSearch from "./components/ServerSearch";
import { useContext, useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import ServerEntries from "./components/ServerEntries.jsx";
import Icon from "@mdi/react";
import {
    mdiCursorDefaultClick,
    mdiTag,
    mdiConnection,
    mdiContentCopy,
    mdiFolderOpen,
    mdiFolderPlus,
    mdiFolderRemove,
    mdiFormTextbox,
    mdiPencil,
    mdiPower,
    mdiServerMinus,
    mdiServerPlus,
    mdiStop,
    mdiAccountCircle,
    mdiImport,
    mdiFileDocumentOutline,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import { useDrop, useDragLayer } from "react-dnd";
import { deleteRequest, patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import TagFilterMenu from "./components/ServerSearch/components/TagFilterMenu";
import ProxmoxLogo from "./assets/proxmox.jsx";
import TagsSubmenu from "./components/TagsSubmenu";

const filterEntries = (entries, searchTerm, selectedTags = []) => {
    return entries
        .map(entry => {
            if (entry.type === "folder" || entry.type === "organization") {
                const filteredEntries = filterEntries(entry.entries, searchTerm, selectedTags);
                if (filteredEntries.length > 0) return { ...entry, entries: filteredEntries };
                if (searchTerm && entry.name.toLowerCase().includes(searchTerm.toLowerCase())) return {
                    ...entry,
                    entries: filteredEntries,
                };

            } else if (entry.type === "server" || entry.type.startsWith("pve-")) {
                const nameMatch = !searchTerm || entry.name.toLowerCase().includes(searchTerm.toLowerCase());
                const ipMatch = !searchTerm || (entry.ip && entry.ip.toLowerCase().includes(searchTerm.toLowerCase()));

                const tagMatch = selectedTags.length === 0 || (entry.tags && entry.tags.some(tag => selectedTags.includes(tag.id)));

                if ((nameMatch || ipMatch) && tagMatch) return entry;

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
                               setServerDialogOpen,
                               setCurrentFolderId,
                               setProxmoxDialogOpen,
                               setSSHConfigImportDialogOpen,
                               setEditServerId,
                               connectToServer,
                               openSFTP,
                               setCurrentOrganizationId,
                           }) => {
    const { t } = useTranslation();
    const { servers, loadServers, getServerById } = useContext(ServerContext);
    const { identities } = useContext(IdentityContext);
    const [search, setSearch] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);
    const [showTagFilter, setShowTagFilter] = useState(false);
    const [contextClickedType, setContextClickedType] = useState(null);
    const [contextClickedId, setContextClickedId] = useState(null);
    const [renameStateId, setRenameStateId] = useState(null);
    const [width, setWidth] = useState(288);
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const serverListRef = useRef(null);
    const serversContainerRef = useRef(null);
    const scrollIntervalRef = useRef(null);
    const tagButtonRef = useRef(null);

    const contextMenu = useContextMenu();

    const { isDragging, clientOffset } = useDragLayer((monitor) => ({
        isDragging: monitor.isDragging(),
        clientOffset: monitor.getClientOffset(),
    }));

    const [{ isOver }, dropRef] = useDrop({
        accept: ["server", "folder"],
        drop: async (item, monitor) => {
            const didDrop = monitor.didDrop();
            if (didDrop) return;

            try {
                if (item.type === "server") {
                    await patchRequest(`entries/${item.id}/reposition`, {
                        targetId: null,
                        placement: "after",
                        folderId: null,
                    });
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
            isOver: monitor.isOver({ shallow: true }),
        }),
    });

    const filteredServers = search || selectedTags.length > 0
        ? filterEntries(servers, search, selectedTags)
        : servers;
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

        contextMenu.open(e, { x: e.clientX, y: e.clientY });
    };

    const server = contextClickedId ? (contextClickedType === "server-object" || contextClickedType?.startsWith("pve-")) ? getServerById(contextClickedId) : null : null;
    const isOrgFolder = contextClickedId && contextClickedId.toString().startsWith("org-");

    const createFolder = () => {
        const organizationId = isOrgFolder ? contextClickedId.toString().split("-")[1] : undefined;

        putRequest("folders", {
            name: "New Folder",
            parentId: isOrgFolder ? undefined : (contextClickedId === null ? undefined : contextClickedId),
            organizationId: organizationId,
        }).then(async (result) => {
            await loadServers();
            if (result.id) setRenameStateId(result.id);
        });
    };

    const deleteFolder = () => deleteRequest("folders/" + contextClickedId).then(loadServers);

    const deleteServer = () => deleteRequest("entries/" + contextClickedId).then(loadServers);

    const createServer = () => {
        if (isOrgFolder) {
            const orgId = parseInt(contextClickedId.toString().split("-")[1]);
            setCurrentFolderId(null);
            setCurrentOrganizationId(orgId);
        } else {
            setCurrentFolderId(contextClickedId);
            setCurrentOrganizationId(null);
        }
        setServerDialogOpen();
    };

    const createPVEServer = () => {
        if (isOrgFolder) {
            const orgId = parseInt(contextClickedId.toString().split("-")[1]);
            setCurrentFolderId(null);
            setCurrentOrganizationId(orgId);
        } else {
            setCurrentFolderId(contextClickedId);
            setCurrentOrganizationId(null);
        }
        setProxmoxDialogOpen();
    };

    const openSSHConfigImport = () => {
        if (isOrgFolder) {
            const orgId = parseInt(contextClickedId.toString().split("-")[1]);
            setCurrentFolderId(null);
            setCurrentOrganizationId(orgId);
        } else {
            setCurrentFolderId(contextClickedId);
            setCurrentOrganizationId(null);
        }
        setSSHConfigImportDialogOpen();
    };

    const connect = (identityId = null) => {
        const targetIdentityId = identityId || server?.identities[0];
        connectToServer(server?.id, targetIdentityId);
    };

    const connectSFTP = (identityId = null) => {
        const targetIdentityId = identityId || server?.identities[0];
        openSFTP(server?.id, targetIdentityId);
    };

    const getIdentityName = (identityId) => {
        const identity = identities?.find(id => id.id === identityId);
        return identity ? `${identity.name}` : `Identity ${identityId}`;
    };

    const editServer = () => {
        setEditServerId(contextClickedId);
        setServerDialogOpen();
    };

    const editPVEServer = () => {
        setEditServerId(contextClickedId);
        setProxmoxDialogOpen();
    };

    const postPVEAction = (type) => {
        postRequest(`integrations/entry/${contextClickedId}/${type}`)
            .then(loadServers);
    };

    const deletePVEServer = () => {
        deleteRequest("integrations/" + contextClickedId.split("-")[1]).then(loadServers);
    };

    const duplicateServer = async () => {
        const serverToDuplicate = getServerById(contextClickedId);
        if (!serverToDuplicate) return;

        try {
            await postRequest(`entries/${serverToDuplicate.id}/duplicate`);
            await loadServers();
        } catch (error) {
            console.error("Failed to duplicate server:", error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showTagFilter && tagButtonRef.current && !tagButtonRef.current.contains(e.target)) {
                const tagMenu = document.querySelector(".tag-filter-menu");
                if (tagMenu && !tagMenu.contains(e.target)) {
                    setShowTagFilter(false);
                }
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showTagFilter]);

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
        document.addEventListener("mousemove", resize);
        document.addEventListener("mouseup", stopResizing);

        return () => {
            document.removeEventListener("mousemove", resize);
            document.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing]);

    useEffect(() => {
        if (!isDragging || !clientOffset || !serversContainerRef.current) {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
            return;
        }

        const container = serversContainerRef.current;
        const rect = container.getBoundingClientRect();
        const scrollThreshold = 50;
        const scrollSpeed = 10;

        const mouseY = clientOffset.y;
        const distanceFromTop = mouseY - rect.top;
        const distanceFromBottom = rect.bottom - mouseY;

        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }

        if (distanceFromTop < scrollThreshold && distanceFromTop > 0) {
            scrollIntervalRef.current = setInterval(() => {
                container.scrollTop = Math.max(0, container.scrollTop - scrollSpeed);
            }, 16);
        } else if (distanceFromBottom < scrollThreshold && distanceFromBottom > 0) {
            scrollIntervalRef.current = setInterval(() => {
                container.scrollTop = Math.min(
                    container.scrollHeight - container.clientHeight,
                    container.scrollTop + scrollSpeed,
                );
            }, 16);
        }

        return () => {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
        };
    }, [isDragging, clientOffset]);

    return (
        <div
            className={`server-list ${isCollapsed ? "collapsed" : ""}`}
            style={{ width: isCollapsed ? "0px" : `${width}px` }} ref={serverListRef}
            onMouseDown={isCollapsed ? startResizing : undefined}>
            {!isCollapsed && (
                <div className="server-list-inner" ref={dropRef}>
                    <div className="search-container">
                        <ServerSearch search={search} setSearch={setSearch} />
                        <div
                            ref={tagButtonRef}
                            className={`tag-filter-button ${selectedTags.length > 0 ? "active" : ""}`}
                            onClick={() => setShowTagFilter(!showTagFilter)}
                            title={t("servers.tags.filterByTags")}>
                            <Icon path={mdiTag} />
                            {selectedTags.length > 0 && (
                                <span className="tag-count">{selectedTags.length}</span>
                            )}
                        </div>
                    </div>
                    {showTagFilter && (
                        <TagFilterMenu
                            selectedTags={selectedTags}
                            setSelectedTags={setSelectedTags}
                            onClose={() => setShowTagFilter(false)}
                        />
                    )}
                    {servers && servers.length >= 1 && (
                        <div className={`servers${isOver ? " drop-zone-active" : ""}`}
                             onContextMenu={handleContextMenu}
                             ref={serversContainerRef}>
                            <ServerEntries entries={renameStateServers} setRenameStateId={setRenameStateId}
                                           nestedLevel={0} connectToServer={connectToServer} />
                        </div>
                    )}
                    {servers && servers.length === 0 && (
                        <div className={`no-servers${isOver ? " drop-zone-active" : ""}`}
                             onContextMenu={handleContextMenu}>
                            <Icon path={mdiCursorDefaultClick} />
                            <p>Right-click to add a new server</p>
                        </div>
                    )}

                    <ContextMenu
                        isOpen={contextMenu.isOpen}
                        position={contextMenu.position}
                        onClose={contextMenu.close}
                        trigger={contextMenu.triggerRef}
                    >
                        {contextClickedType !== "server-object" &&
                            contextClickedType !== "pve-object" &&
                            contextClickedType !== "pve-entry" && (
                                <>
                                    <ContextMenuItem
                                        icon={mdiFolderPlus}
                                        label={t("servers.contextMenu.createFolder")}
                                        onClick={createFolder}
                                    />
                                    {(contextClickedType === null || contextClickedType === "folder-object" || isOrgFolder) && (
                                        <ContextMenuItem
                                            icon={mdiServerPlus}
                                            label={t("servers.contextMenu.createServer")}
                                            onClick={createServer}
                                        />
                                    )}
                                </>
                            )}

                        {contextClickedType === "folder-object" && !isOrgFolder && (
                            <>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiFormTextbox}
                                    label={t("servers.contextMenu.renameFolder")}
                                    onClick={() => setRenameStateId(contextClickedId)}
                                />
                                <ContextMenuItem
                                    icon={mdiImport}
                                    label={t("servers.contextMenu.import")}
                                >
                                    <ContextMenuItem
                                        icon={<ProxmoxLogo />}
                                        label={t("servers.contextMenu.pve")}
                                        onClick={createPVEServer}
                                    />
                                    <ContextMenuItem
                                        icon={mdiFileDocumentOutline}
                                        label={t("servers.contextMenu.sshConfig")}
                                        onClick={openSSHConfigImport}
                                    />
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiFolderRemove}
                                    label={t("servers.contextMenu.deleteFolder")}
                                    onClick={deleteFolder}
                                    danger
                                />
                            </>
                        )}

                        {contextClickedType === "server-object" && (
                            <>
                                {server?.identities?.length > 0 && (
                                    <>
                                        {server.identities.length === 1 ? (
                                            <ContextMenuItem
                                                icon={mdiConnection}
                                                label={t("servers.contextMenu.connect")}
                                                onClick={() => connect()}
                                            />
                                        ) : (
                                            <ContextMenuItem
                                                icon={mdiConnection}
                                                label={t("servers.contextMenu.connect")}
                                            >
                                                {server.identities.map((identityId) => (
                                                    <ContextMenuItem
                                                        key={identityId}
                                                        icon={mdiAccountCircle}
                                                        label={getIdentityName(identityId)}
                                                        onClick={() => connect(identityId)}
                                                    />
                                                ))}
                                            </ContextMenuItem>
                                        )}
                                    </>
                                )}

                                {server?.identities?.length > 0 && server?.protocol === "ssh" && (
                                    <>
                                        {server.identities.length === 1 ? (
                                            <ContextMenuItem
                                                icon={mdiFolderOpen}
                                                label={t("servers.contextMenu.openSFTP")}
                                                onClick={() => connectSFTP()}
                                            />
                                        ) : (
                                            <ContextMenuItem
                                                icon={mdiFolderOpen}
                                                label={t("servers.contextMenu.openSFTP")}
                                            >
                                                {server.identities.map((identityId) => (
                                                    <ContextMenuItem
                                                        key={identityId}
                                                        icon={mdiAccountCircle}
                                                        label={getIdentityName(identityId)}
                                                        onClick={() => connectSFTP(identityId)}
                                                    />
                                                ))}
                                            </ContextMenuItem>
                                        )}
                                    </>
                                )}

                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiPencil}
                                    label={t("servers.contextMenu.editServer")}
                                    onClick={editServer}
                                />

                                <ContextMenuItem
                                    icon={mdiContentCopy}
                                    label={t("servers.contextMenu.duplicateServer")}
                                    onClick={duplicateServer}
                                />

                                <ContextMenuItem
                                    icon={mdiTag}
                                    label={t("servers.tags.title")}
                                >
                                    <TagsSubmenu entryId={contextClickedId} entryTags={server?.tags || []} />
                                </ContextMenuItem>

                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiServerMinus}
                                    label={t("servers.contextMenu.deleteServer")}
                                    onClick={deleteServer}
                                    danger
                                />
                            </>
                        )}

                        {contextClickedType === "pve-qemu" && (
                            <>
                                <ContextMenuItem
                                    icon={mdiPencil}
                                    label={t("servers.contextMenu.editPVE")}
                                    onClick={editPVEServer}
                                />
                                <ContextMenuItem
                                    icon={mdiTag}
                                    label={t("servers.tags.title")}
                                >
                                    <TagsSubmenu entryId={contextClickedId} entryTags={server?.tags || []} />
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiServerMinus}
                                    label={t("servers.contextMenu.deletePVE")}
                                    onClick={deletePVEServer}
                                    danger
                                />
                            </>
                        )}

                        {server?.status === "running" && (
                            <>
                                <ContextMenuItem
                                    icon={mdiConnection}
                                    label={t("servers.contextMenu.connect")}
                                    onClick={() => connect()}
                                />
                                <ContextMenuSeparator />
                            </>
                        )}

                        {server?.status === "running" && server.type !== "pve-shell" && (
                            <>
                                <ContextMenuItem
                                    icon={mdiPower}
                                    label={t("servers.contextMenu.shutdown")}
                                    onClick={() => postPVEAction("shutdown")}
                                />
                                <ContextMenuItem
                                    icon={mdiStop}
                                    label={t("servers.contextMenu.stop")}
                                    onClick={() => postPVEAction("stop")}
                                />
                            </>
                        )}

                        {server?.status === "stopped" && (
                            <ContextMenuItem
                                icon={mdiPower}
                                label={t("servers.contextMenu.start")}
                                onClick={() => postPVEAction("start")}
                            />
                        )}
                    </ContextMenu>
                </div>
            )}
            <div className={`resizer${isResizing ? " is-resizing" : ""}`} onMouseDown={startResizing} />
        </div>
    );
};
