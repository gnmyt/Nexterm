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
    mdiPowerPlug,
    mdiStop,
    mdiAccountCircle,
    mdiImport,
    mdiFileDocumentOutline,
    mdiPlusCircle,
    mdiConsole,
    mdiMonitor,
    mdiDesktopClassic,
    mdiCog,
    mdiPlay,
    mdiScript,
    mdiTunnel,
} from "@mdi/js";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import { useDrop, useDragLayer } from "react-dnd";
import { deleteRequest, getRequest, patchRequest, postRequest, putRequest } from "@/common/utils/RequestUtil.js";
import TagFilterMenu from "./components/ServerSearch/components/TagFilterMenu";
import ProxmoxLogo from "./assets/proxmox.jsx";
import TagsSubmenu from "./components/TagsSubmenu";
import ScriptsMenu from "./components/ScriptsMenu";
import Fuse from "fuse.js";
import { useToast } from "@/common/contexts/ToastContext.jsx";

const flattenEntries = (entries, path = []) => entries.flatMap(entry =>
    entry.type === "folder" || entry.type === "organization"
        ? flattenEntries(entry.entries, [...path, entry])
        : [{ ...entry, _path: path }]
);

const filterEntries = (entries, searchTerm, selectedTags = []) => {
    const tagFilter = e => !selectedTags.length || e.tags?.some(tag => selectedTags.includes(tag.id));
    const isContainer = e => e.type === "folder" || e.type === "organization";

    if (!searchTerm) {
        return entries.map(e => isContainer(e)
            ? (f => f.length ? { ...e, entries: f } : null)(filterEntries(e.entries, searchTerm, selectedTags))
            : (tagFilter(e) ? e : null)
        ).filter(Boolean);
    }

    const flat = flattenEntries(entries);
    const opts = { keys: ['name', 'ip'], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 1 };
    let results = new Fuse(flat, opts).search(searchTerm);
    if (results.length > 0 && results.length < 3) results = new Fuse(flat, { ...opts, threshold: 0.5 }).search(searchTerm);
    else if (results.length > 20) results = new Fuse(flat, { ...opts, threshold: 0.2 }).search(searchTerm);

    const ids = new Set(results.map(r => r.item).filter(e => !e.type?.startsWith("pve-") && e.type !== "server" || tagFilter(e)).map(e => e.id));
    const rebuild = arr => arr.map(e => isContainer(e)
        ? (f => f.length || ids.has(e.id) ? { ...e, entries: f } : null)(rebuild(e.entries))
        : (ids.has(e.id) ? e : null)
    ).filter(Boolean);
    return rebuild(entries);
};

const applyRenameState = folderId => entry =>
    entry.type === "folder" && entry.id === parseInt(folderId)
        ? { ...entry, renameState: true }
        : entry.entries ? { ...entry, entries: entry.entries.map(applyRenameState(folderId)) } : entry;

export const ServerList = ({
    setServerDialogOpen,
    setCurrentFolderId,
    setProxmoxDialogOpen,
    setSSHConfigImportDialogOpen,
    setEditServerId,
    connectToServer,
    openSFTP,
    setCurrentOrganizationId,
    hibernatedSessions = [],
    resumeSession,
    openDirectConnect,
    runScript,
    openPortForward,
    mobileOpen = false,
    setMobileOpen,
}) => {
    const { t } = useTranslation();
    const { servers, loadServers, getServerById } = useContext(ServerContext);
    const { identities } = useContext(IdentityContext);
    const { sendToast } = useToast();
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
    const [scripts, setScripts] = useState([]);
    const [sourceScripts, setSourceScripts] = useState([]);
    const [scriptsMenuOpen, setScriptsMenuOpen] = useState(false);
    const [scriptsMenuServer, setScriptsMenuServer] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    const contextMenu = useContextMenu();

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile && setMobileOpen) setMobileOpen(false);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [setMobileOpen]);

    useEffect(() => {
        if (!isMobile || !mobileOpen) return;
        const handleClickOutside = (e) => {
            if (serverListRef.current && !serverListRef.current.contains(e.target) && 
                !e.target.closest('.server-list-toggle') &&
                !e.target.closest('.mobile-nav')) {
                setMobileOpen?.(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMobile, mobileOpen, setMobileOpen]);

    const server = contextClickedId ? (contextClickedType === "server-object" || contextClickedType?.startsWith("pve-")) ? getServerById(contextClickedId) : null : null;
    const isOrgFolder = contextClickedId && contextClickedId.toString().startsWith("org-");

    const findOrganizationForServer = (serverIdNum, entries, currentOrg = null) => {
        for (const entry of entries) {
            if ((entry.type === "server" || entry.type?.startsWith("pve-")) && entry.id === serverIdNum) {
                return currentOrg;
            } else if (entry.type === "organization") {
                const found = findOrganizationForServer(serverIdNum, entry.entries || [], entry);
                if (found) return found;
            } else if (entry.type === "folder" && entry.entries) {
                const found = findOrganizationForServer(serverIdNum, entry.entries, currentOrg);
                if (found) return found;
            }
        }
        return null;
    };

    const getServerOrganizationId = (serverId) => {
        if (!servers || !serverId) return null;
        const org = findOrganizationForServer(parseInt(serverId), servers);
        if (org && org.id) {
            return parseInt(org.id.toString().split("-")[1]);
        }
        return null;
    };

    useEffect(() => {
        if (contextMenu.isOpen && contextClickedType === "server-object" && server?.protocol === "ssh") {
            getRequest("scripts/all").then(setScripts).catch(() => setScripts([]));
            getRequest("scripts/sources").then(setSourceScripts).catch(() => setSourceScripts([]));
        }
    }, [contextMenu.isOpen, contextClickedType, server?.protocol]);

    const openScriptsMenu = () => {
        if (server) {
            setScriptsMenuServer(server);
            setScriptsMenuOpen(true);
            contextMenu.close();
        }
    };

    const closeScriptsMenu = () => {
        setScriptsMenuOpen(false);
        setScriptsMenuServer(null);
    };

    const wakeServer = async () => {
        if (!server) return;

        try {
            await postRequest(`entries/${server.id}/wake`);
            sendToast("Success", t("servers.wol.successDescription", { name: server.name }));
        } catch (error) {
            sendToast("Error", t("servers.wol.errorDescription"));
        }
    };

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

    const hibernatedSessionsForServer = server ? hibernatedSessions.filter(s => s.server.id == server.id) : [];
    
    const formatSessionDate = (session) => {
        if (!session?.lastActivity) return '';
        const diff = Date.now() - new Date(session.lastActivity);
        const mins = Math.floor(diff / 60000), hrs = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
        if (mins < 1) return t('servers.time.justNow');
        if (mins < 60) return t(mins === 1 ? 'servers.time.minuteAgo' : 'servers.time.minutesAgo', { count: mins });
        if (hrs < 24) return t(hrs === 1 ? 'servers.time.hourAgo' : 'servers.time.hoursAgo', { count: hrs });
        if (days < 7) return t(days === 1 ? 'servers.time.dayAgo' : 'servers.time.daysAgo', { count: days });
        return new Date(session.lastActivity).toLocaleDateString();
    };

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

    const setFolderContext = () => {
        if (isOrgFolder) {
            setCurrentFolderId(null);
            setCurrentOrganizationId(parseInt(contextClickedId.toString().split("-")[1]));
        } else {
            setCurrentFolderId(contextClickedId);
            setCurrentOrganizationId(null);
        }
    };

    const createServer = (protocol) => { setFolderContext(); setServerDialogOpen(protocol); };
    const createPVEServer = () => { setFolderContext(); setProxmoxDialogOpen(); };
    const openSSHConfigImport = () => { setFolderContext(); setSSHConfigImportDialogOpen(); };

    const getIdentity = (id = null) => identities?.find(i => i.id === (id || server?.identities[0]));
    const connect = (id = null) => connectToServer(server?.id, getIdentity(id));
    const connectSFTP = (id = null) => openSFTP(server?.id, getIdentity(id));

    const getIdentityName = (identityId) => {
        const identity = identities?.find(id => id.id === identityId);
        return identity ? `${identity.name}` : `Identity ${identityId}`;
    };

    const editServer = () => {
        const orgId = getServerOrganizationId(contextClickedId);
        setCurrentOrganizationId(orgId);
        setEditServerId(contextClickedId);
        setServerDialogOpen();
    };

    const editPVEServer = () => {
        const integrationId = server?.integrationId;
        if (integrationId) {
            setEditServerId(integrationId);
            setProxmoxDialogOpen();
        }
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
        <>
            {isMobile && mobileOpen && <div className="server-list-overlay" onClick={() => setMobileOpen?.(false)} />}
            <div
                className={`server-list ${isCollapsed ? "collapsed" : ""} ${isMobile ? "mobile" : ""} ${mobileOpen ? "mobile-open" : ""}`}
                style={!isMobile ? { width: isCollapsed ? "0px" : `${width}px` } : undefined} 
                ref={serverListRef}
                onMouseDown={!isMobile && isCollapsed ? startResizing : undefined}>
            {(!isCollapsed || (isMobile && mobileOpen)) && (
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
                                nestedLevel={0} connectToServer={connectToServer} hibernatedSessions={hibernatedSessions} />
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
                        {contextClickedType !== "server-object" && (
                            <>
                                {(contextClickedType === null || contextClickedType === "folder-object" || isOrgFolder) && (
                                    <ContextMenuItem
                                        icon={mdiPlusCircle}
                                        label={t("servers.contextMenu.new")}
                                    >
                                        <ContextMenuItem
                                            icon={mdiConsole}
                                            label={t("servers.contextMenu.sshServer")}
                                            onClick={() => createServer("ssh")}
                                        />
                                        <ContextMenuItem
                                            icon={mdiConsole}
                                            label={t("servers.contextMenu.telnetServer")}
                                            onClick={() => createServer("telnet")}
                                        />
                                        <ContextMenuItem
                                            icon={mdiDesktopClassic}
                                            label={t("servers.contextMenu.rdpServer")}
                                            onClick={() => createServer("rdp")}
                                        />
                                        <ContextMenuItem
                                            icon={mdiMonitor}
                                            label={t("servers.contextMenu.vncServer")}
                                            onClick={() => createServer("vnc")}
                                        />
                                    </ContextMenuItem>
                                )}
                                {contextClickedType === "folder-object" && !isOrgFolder && (
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
                                )}
                            </>
                        )}

                        {contextClickedType === "folder-object" && !isOrgFolder && (
                            <>
                                <ContextMenuItem
                                    icon={mdiFolderPlus}
                                    label={t("servers.contextMenu.createFolder")}
                                    onClick={createFolder}
                                />
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiFormTextbox}
                                    label={t("servers.contextMenu.renameFolder")}
                                    onClick={() => setRenameStateId(contextClickedId)}
                                />
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiFolderRemove}
                                    label={t("servers.contextMenu.deleteFolder")}
                                    onClick={deleteFolder}
                                    danger
                                />
                            </>
                        )}

                        {(contextClickedType === null || isOrgFolder) && (
                            <ContextMenuItem
                                icon={mdiFolderPlus}
                                label={t("servers.contextMenu.createFolder")}
                                onClick={createFolder}
                            />
                        )}

                        {contextClickedType === "server-object" && server?.type === "server" && (
                            <>
                                {hibernatedSessionsForServer.length > 0 && (
                                    <>
                                        {hibernatedSessionsForServer.length === 1 ? (
                                            <ContextMenuItem
                                                icon={mdiPlay}
                                                label="Resume session"
                                                onClick={() => resumeSession(hibernatedSessionsForServer[0].id)}
                                            />
                                        ) : (
                                            <ContextMenuItem
                                                icon={mdiPlay}
                                                label="Resume session"
                                            >
                                                {hibernatedSessionsForServer.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)).map((session) => (
                                                    <ContextMenuItem
                                                        key={session.id}
                                                        icon={mdiPlay}
                                                        label={formatSessionDate(session)}
                                                        onClick={() => resumeSession(session.id)}
                                                    />
                                                ))}
                                            </ContextMenuItem>
                                        )}
                                        <ContextMenuSeparator />
                                    </>
                                )}
                                {(server?.identities?.length > 0 || server?.protocol === "telnet") && (
                                    <>
                                        {server?.protocol === "telnet" ? (
                                            <ContextMenuItem
                                                icon={mdiConnection}
                                                label={t("servers.contextMenu.connect")}
                                                onClick={() => connectToServer(server?.id)}
                                            />
                                        ) : server.identities.length === 1 ? (
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

                                {server?.identities?.length > 0 && server?.protocol === "ssh" && openPortForward && (
                                    <ContextMenuItem
                                        icon={mdiTunnel}
                                        label={t("servers.contextMenu.forwardPort")}
                                        onClick={() => openPortForward(server)}
                                    />
                                )}

                                {server?.identities?.length > 0 && server?.protocol === "ssh" && (scripts.length > 0 || sourceScripts.length > 0) && (
                                    <ContextMenuItem
                                        icon={mdiScript}
                                        label={t("servers.contextMenu.runScript")}
                                        onClick={openScriptsMenu}
                                    />
                                )}

                                {server?.type === "server" && (server?.protocol === "ssh" || server?.protocol === "telnet" || server?.protocol === "rdp" || server?.protocol === "vnc") && (
                                    <ContextMenuItem
                                        icon={mdiCursorDefaultClick}
                                        label={t("servers.contextMenu.quickConnect")}
                                        onClick={() => openDirectConnect(server)}
                                    />
                                )}

                                {server?.wakeOnLanEnabled && server?.macAddress && (
                                    <ContextMenuItem
                                        icon={mdiPowerPlug}
                                        label={t("servers.contextMenu.wakeOnLan")}
                                        onClick={wakeServer}
                                    />
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

                        {contextClickedType === "server-object" && server?.type?.startsWith("pve-") && (
                            <>
                                {hibernatedSessionsForServer.length > 0 && (
                                    <>
                                        {hibernatedSessionsForServer.length === 1 ? (
                                            <ContextMenuItem
                                                icon={mdiPlay}
                                                label="Resume session"
                                                onClick={() => resumeSession(hibernatedSessionsForServer[0].id)}
                                            />
                                        ) : (
                                            <ContextMenuItem
                                                icon={mdiPlay}
                                                label="Resume session"
                                            >
                                                {hibernatedSessionsForServer.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)).map((session) => (
                                                    <ContextMenuItem
                                                        key={session.id}
                                                        icon={mdiPlay}
                                                        label={formatSessionDate(session)}
                                                        onClick={() => resumeSession(session.id)}
                                                    />
                                                ))}
                                            </ContextMenuItem>
                                        )}
                                        <ContextMenuSeparator />
                                    </>
                                )}
                                {(server?.status === "running" || server?.status === "online") && (
                                    <>
                                        <ContextMenuItem
                                            icon={mdiConnection}
                                            label={t("servers.contextMenu.connect")}
                                            onClick={() => connectToServer(server.id)}
                                        />
                                        <ContextMenuSeparator />
                                    </>
                                )}
                                <ContextMenuItem
                                    icon={mdiPencil}
                                    label={t("servers.contextMenu.editServer")}
                                    onClick={editServer}
                                />
                                <ContextMenuItem
                                    icon={mdiCog}
                                    label={t("servers.contextMenu.editIntegration")}
                                    onClick={editPVEServer}
                                />
                                <ContextMenuItem
                                    icon={mdiTag}
                                    label={t("servers.tags.title")}
                                >
                                    <TagsSubmenu entryId={contextClickedId} entryTags={server?.tags || []} />
                                </ContextMenuItem>
                                {(server?.status === "running" || server?.status === "online") && server.type !== "pve-shell" && (
                                    <>
                                        <ContextMenuSeparator />
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
                                    <>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                            icon={mdiPower}
                                            label={t("servers.contextMenu.start")}
                                            onClick={() => postPVEAction("start")}
                                        />
                                    </>
                                )}
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    icon={mdiServerMinus}
                                    label={t("servers.contextMenu.deleteServer")}
                                    onClick={deleteServer}
                                    danger
                                />
                            </>
                        )}
                    </ContextMenu>
                    <ScriptsMenu
                        visible={scriptsMenuOpen}
                        onClose={closeScriptsMenu}
                        scripts={scripts}
                        server={scriptsMenuServer}
                        serverOrganizationId={scriptsMenuServer ? getServerOrganizationId(scriptsMenuServer.id) : null}
                        onRunScript={runScript}
                        getIdentityName={getIdentityName}
                    />
                </div>
            )}
            {!isMobile && !isCollapsed && <div className={`resizer${isResizing ? " is-resizing" : ""}`} onMouseDown={startResizing} />}
        </div>
        </>
    );
};
