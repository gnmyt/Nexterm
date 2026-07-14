import "./styles.sass";
import ServerList from "@/pages/Servers/components/ServerList";
import { useContext, useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import WelcomePanel from "@/pages/Servers/components/WelcomePanel";
import ServerDialog from "@/pages/Servers/components/ServerDialog";
import ViewContainer from "@/pages/Servers/components/ViewContainer";
import ProxmoxDialog from "@/pages/Servers/components/ProxmoxDialog";
import SSHConfigImportDialog from "@/pages/Servers/components/SSHConfigImportDialog";
import ConnectionReasonDialog from "@/pages/Servers/components/ConnectionReasonDialog";
import DirectConnectDialog from "@/pages/Servers/components/DirectConnectDialog";
import FileEditorWindow from "@/common/components/FileEditorWindow";
import FilePreviewWindow from "@/common/components/FilePreviewWindow";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { StateStreamContext, STATE_TYPES } from "@/common/contexts/StateStreamContext.jsx";
import { isTauri } from "@/common/utils/TauriUtil.js";
import { getTabId, getBrowserId } from "@/common/utils/ConnectionUtil.js";
import { postRequest, deleteRequest } from "@/common/utils/RequestUtil";

export const Servers = () => {

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [serverDialogProtocol, setServerDialogProtocol] = useState(null);
    const [proxmoxDialogOpen, setProxmoxDialogOpen] = useState(false);
    const [sshConfigImportDialogOpen, setSSHConfigImportDialogOpen] = useState(false);
    const [connectionReasonDialogOpen, setConnectionReasonDialogOpen] = useState(false);
    const [directConnectDialogOpen, setDirectConnectDialogOpen] = useState(false);
    const [directConnectServer, setDirectConnectServer] = useState(null);
    const [pendingConnection, setPendingConnection] = useState(null);
    const [openFileEditors, setOpenFileEditors] = useState([]);
    const [mobileServerListOpen, setMobileServerListOpen] = useState(false);
    const [leftPaneSlot, setLeftPaneSlot] = useState(null);

    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [currentOrganizationId, setCurrentOrganizationId] = useState(null);
    const [editServerId, setEditServerId] = useState(null);
    const { activeSessions, setActiveSessions, activeSessionId, setActiveSessionId, poppedOutSessions } = useActiveSessions();
    const { getServerById, servers } = useContext(ServerContext);
    const { registerHandler } = useContext(StateStreamContext);
    const location = useLocation();
    const navigate = useNavigate();

    const [hibernatedSessions, setHibernatedSessions] = useState([]);
    const closingSessionsRef = useRef(new Set());
    const erroredSessionsRef = useRef(new Map());

    const markSessionErrored = useCallback((sessionId, message) => {
        if (erroredSessionsRef.current.has(sessionId)) return;
        erroredSessionsRef.current.set(sessionId, message);
    }, []);

    const getSessionError = useCallback((sessionId) => {
        return erroredSessionsRef.current.get(sessionId) || null;
    }, []);

    const visibleSessions = activeSessions.filter(s => !poppedOutSessions.includes(s.id));

    useEffect(() => {
        const handleToggle = () => setMobileServerListOpen(prev => !prev);
        window.addEventListener('toggleServerList', handleToggle);
        return () => window.removeEventListener('toggleServerList', handleToggle);
    }, []);

    useEffect(() => {
        setLeftPaneSlot(document.getElementById("left-pane-slot"));
    }, []);

    const handleConnectionsUpdate = useCallback((sessions) => {
        if (!servers) return;
        const mappedSessions = sessions.map(session => {
            const server = getServerById(session.entryId);
            if (!server) return null;
            return {
                id: session.sessionId,
                server,
                identity: session.configuration.identityId,
                isHibernated: session.isHibernated,
                lastActivity: session.lastActivity,
                type: session.configuration.type || undefined,
                organizationId: session.organizationId,
                organizationName: session.organizationName,
                osName: session.osName || null,
                scriptId: session.configuration.scriptId || undefined,
                shareId: session.shareId || null,
                shareWritable: session.shareWritable || false,
            };
        }).filter(Boolean);

        const closingSessions = closingSessionsRef.current;
        const activeMapped = mappedSessions.filter(s => !s.isHibernated && !closingSessions.has(s.id));
        const hibernatedMapped = mappedSessions.filter(s => s.isHibernated);
        
        const serverSessionIds = new Set(sessions.map(s => s.sessionId));
        closingSessions.forEach(id => {
            if (!serverSessionIds.has(id)) {
                closingSessions.delete(id);
            }
        });
        
        const newActiveIds = new Set(activeMapped.map(s => s.id));
        let mergedSessions = [];

        setActiveSessions(prev => {
            const prevMap = new Map(prev.map(s => [s.id, s]));
            const localOnly = prev.filter(s => s.type === "notes");
            const merged = activeMapped.map(newSession => {
                const existing = prevMap.get(newSession.id);
                return existing ? { ...newSession, scriptId: existing.scriptId || newSession.scriptId, scriptName: existing.scriptName, osName: newSession.osName || existing.osName } : newSession;
            });
            const mergedIds = new Set(merged.map(s => s.id));
            const erroredPinned = prev.filter(s =>
                erroredSessionsRef.current.has(s.id) && !mergedIds.has(s.id) && s.type !== "notes"
            );
            mergedSessions = [...merged, ...erroredPinned, ...localOnly];
            return mergedSessions;
        });
        setHibernatedSessions(hibernatedMapped);

        setActiveSessionId(prev => {
            if (prev && (newActiveIds.has(prev) || mergedSessions.some(s => s.id === prev))) return prev;
            return mergedSessions.at(-1)?.id || null;
        });
    }, [servers, getServerById, setActiveSessions, setActiveSessionId]);

    useEffect(() => {
        if (servers) return registerHandler(STATE_TYPES.CONNECTIONS, handleConnectionsUpdate);
    }, [servers, registerHandler, handleConnectionsUpdate]);

    const findOrganizationForServer = (serverIdNum, entries, currentOrg = null) => {
        for (const entry of entries) {
            if ((entry.type === "server" || entry.type === "pve-server") && entry.id === serverIdNum) {
                return currentOrg;
            } else if (entry.type === "organization") {
                const found = findOrganizationForServer(serverIdNum, entry.entries, entry);
                if (found) return found;
            } else if (entry.type === "folder" && entry.entries) {
                const found = findOrganizationForServer(serverIdNum, entry.entries, currentOrg);
                if (found) return found;
            }
        }
        return null;
    };

    const checkConnectionReasonRequired = (serverId, servers) => {
        if (!servers || !serverId) return false;

        return findOrganizationForServer(parseInt(serverId), servers)?.requireConnectionReason || false;
    };

    const connectToServer = async (serverId, identity, overrideRenderer) => {
        const server = getServerById(serverId);

        const hibernated = hibernatedSessions.find(s => s.server.id === serverId && s.identity === identity?.id);
        if (hibernated) {
            resumeConnection(hibernated.id);
            return;
        }

        const isPveEntry = server?.type?.startsWith("pve-");
        const hasIdentities = server?.identities && server.identities.length > 0;
        if (server && !isPveEntry && !hasIdentities) {
            openDirectConnect(server);
            return;
        }

        initiateConnection({ server: { ...server, renderer: overrideRenderer || server.renderer }, identity });
    };

    const openSFTP = async (server, identity) => {
        initiateConnection({ server: getServerById(server), identity, type: "sftp" });
    };

    const performConnection = async (server, identity, connectionReason = null, type = null, directIdentity = null, scriptId = null, scriptName = null) => {
        try {
            const payload = {
                entryId: server.id,
                identityId: identity?.id,
                connectionReason,
                type,
                tabId: getTabId(),
                browserId: getBrowserId(),
            };

            if (directIdentity) payload.directIdentity = directIdentity;
            if (scriptId) payload.scriptId = scriptId;
            const session = await postRequest("/connections", payload);

            const organization = findOrganizationForServer(server.id, servers);
            const organizationId = organization ? parseInt(organization.id.split("-")[1]) : null;

            const sessionData = {
                server,
                identity: identity?.id,
                id: session.sessionId,
                type: type || undefined,
                organizationId: organizationId,
                organizationName: organization?.name || null,
                scriptId: scriptId || undefined,
                scriptName: scriptName || undefined,
            };

            setActiveSessions(prevSessions => [...prevSessions, sessionData]);
            setActiveSessionId(session.sessionId);
        } catch (error) {
            console.error("Failed to create session", error);
        }
    };

    const initiateConnection = (options) => {
        if (!options.server) return;

        const requiresReason = checkConnectionReasonRequired(options.server.id, servers);
        if (requiresReason) {
            setPendingConnection(options);
            setConnectionReasonDialogOpen(true);
            return;
        }

        void performConnection(
            options.server,
            options.identity ?? null,
            null,
            options.type ?? null,
            options.directIdentity ?? null,
            options.scriptId ?? null,
            options.scriptName ?? null,
        );
    };

    const runScript = async (serverId, identityId, scriptId) => {
        const server = getServerById(serverId);
        if (!server) {
            console.error("Server not found");
            return;
        }

        initiateConnection({ server, identity: { id: identityId }, scriptId });
    };

    const resumeConnection = async (sessionId) => {
        try {
            await postRequest(`/connections/${sessionId}/resume`, {
                tabId: getTabId(),
                browserId: getBrowserId(),
            });
            setActiveSessionId(sessionId);
        } catch (error) {
            console.error("Failed to resume session", error);
        }
    };

    const handleConnectionReasonProvided = (reason) => {
        if (pendingConnection) {
            void performConnection(
                pendingConnection.server,
                pendingConnection.identity ?? null,
                reason,
                pendingConnection.type ?? null,
                pendingConnection.directIdentity ?? null,
                pendingConnection.scriptId ?? null,
                pendingConnection.scriptName ?? null,
            );
            setPendingConnection(null);
        }
        setConnectionReasonDialogOpen(false);
    };

    const handleConnectionReasonCanceled = () => {
        setPendingConnection(null);
        setConnectionReasonDialogOpen(false);
    };

    const disconnectFromServer = useCallback((sessionId) => {
        erroredSessionsRef.current.delete(sessionId);
        setActiveSessions(prev => {
            const newSessions = prev.filter(session => session.id !== sessionId);
            setActiveSessionId(currentActiveId => {
                if (newSessions.length === 0) return null;
                if (sessionId === currentActiveId) return newSessions.at(-1)?.id || null;
                return currentActiveId;
            });
            return newSessions;
        });
    }, [setActiveSessions, setActiveSessionId]);

    const closeSession = (sessionId) => {
        const session = activeSessions.find(s => s.id === sessionId);
        if (session?.type !== "notes") {
            closingSessionsRef.current.add(sessionId);
            deleteRequest(`/connections/${sessionId}`).catch(error => {
                console.debug("Session deletion request failed:", error);
            });
        }
        disconnectFromServer(sessionId);
    };

    const openNotes = (serverId) => {
        const server = getServerById(serverId);
        if (!server) return;

        const notesId = `notes-${serverId}`;
        const existing = activeSessions.find(s => s.id === notesId);
        if (existing) {
            setActiveSessionId(notesId);
            return;
        }

        const organization = findOrganizationForServer(server.id, servers);
        const organizationId = organization ? parseInt(organization.id.split("-")[1]) : null;

        const sessionData = {
            server,
            id: notesId,
            type: "notes",
            organizationId,
            organizationName: organization?.name || null,
        };

        setActiveSessions(prev => [...prev, sessionData]);
        setActiveSessionId(notesId);
    };

    const hibernateSession = async (sessionId) => {
        try {
            await postRequest(`/connections/${sessionId}/hibernate`);

            if (sessionId === activeSessionId) {
                const otherSessions = activeSessions.filter(s => s.id !== sessionId);
                setActiveSessionId(otherSessions.at(-1)?.id || null);
            }
        } catch (error) {
            console.error("Failed to hibernate session", error);
        }
    };

    const duplicateSession = async (sessionId) => {
        try {
            const result = await postRequest(`/connections/${sessionId}/duplicate`, {
                tabId: getTabId(),
                browserId: getBrowserId(),
            });

            if (result?.sessionId) {
                const originalSession = activeSessions.find(s => s.id === sessionId);
                if (originalSession) {
                    const sessionData = {
                        ...originalSession,
                        id: result.sessionId,
                        shareId: null,
                        shareWritable: false,
                    };
                    setActiveSessions(prevSessions => [...prevSessions, sessionData]);
                    setActiveSessionId(result.sessionId);
                }
            }
        } catch (error) {
            console.error("Failed to duplicate session", error);
        }
    };

    const openTerminalFromFileManager = async (sessionId, path) => {
        try {
            const originalSession = activeSessions.find(s => s.id === sessionId);
            if (!originalSession) {
                console.error("Original session not found");
                return;
            }

            const payload = {
                entryId: originalSession.server.id,
                identityId: originalSession.identity,
                type: "terminal",
                startPath: path,
                tabId: getTabId(),
                browserId: getBrowserId(),
            };

            const session = await postRequest("/connections", payload);

            const sessionData = {
                server: { ...originalSession.server, renderer: "terminal" },
                identity: originalSession.identity,
                id: session.sessionId,
                type: "terminal",
                organizationId: originalSession.organizationId,
                organizationName: originalSession.organizationName,
            };

            setActiveSessions(prevSessions => [...prevSessions, sessionData]);
            setActiveSessionId(session.sessionId);
        } catch (error) {
            console.error("Failed to open terminal from file manager", error);
        }
    };

    const closeDialog = () => {
        setServerDialogOpen(false);
        setServerDialogProtocol(null);
        setCurrentFolderId(null);
        setEditServerId(null);
    };

    const closePVEDialog = () => {
        setProxmoxDialogOpen(false);
        setCurrentFolderId(null);
        setEditServerId(null);
    };

    const closeSSHConfigImportDialog = () => {
        setSSHConfigImportDialogOpen(false);
        setCurrentFolderId(null);
    };

    const openDirectConnect = (server) => {
        if (server?.protocol === "telnet") {
            initiateConnection({ server });
            return;
        }

        setDirectConnectServer(server);
        setDirectConnectDialogOpen(true);
    };

    const openPortForward = async (server) => {
        if (!isTauri()) return;
        try {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("open_tunnel_window", { 
                entryId: server.id,
                entryName: server.name 
            });
        } catch (error) {
            console.error("Failed to open port forward window", error);
        }
    };

    const closeDirectConnectDialog = () => {
        setDirectConnectDialogOpen(false);
        setDirectConnectServer(null);
    };

    const handleDirectConnect = (directIdentity) => {
        initiateConnection({ server: directConnectServer, directIdentity });
    };

    useEffect(() => {
        if (!servers) return;

        const params = new URLSearchParams(location.search);
        const connectId = params.get("connectId");

        if (connectId) {
            navigate("/servers", { replace: true });

            const handleAutoConnect = async () => {
                const server = getServerById(connectId);
                const isPveEntry = server?.type?.startsWith("pve-");
                const hasIdentities = server?.identities && server.identities.length > 0;

                if (server && (isPveEntry || hasIdentities)) {
                    initiateConnection({ server, identity: isPveEntry ? null : server.identities[0] });
                }
            };

            handleAutoConnect();
        }
    }, [servers, location.search]);

    return (
        <div className="server-page">
            <ServerDialog open={serverDialogOpen} onClose={closeDialog} currentFolderId={currentFolderId}
                          currentOrganizationId={currentOrganizationId} editServerId={editServerId}
                          initialProtocol={serverDialogProtocol} />
            <ProxmoxDialog open={proxmoxDialogOpen} onClose={closePVEDialog}
                           currentFolderId={currentFolderId}
                           currentOrganizationId={currentOrganizationId}
                           editServerId={editServerId} />
            <SSHConfigImportDialog open={sshConfigImportDialogOpen} onClose={closeSSHConfigImportDialog}
                                   currentFolderId={currentFolderId}
                                   currentOrganizationId={currentOrganizationId} />
            <DirectConnectDialog
                open={directConnectDialogOpen}
                onClose={closeDirectConnectDialog}
                server={directConnectServer}
                onConnect={handleDirectConnect}
            />
            <ConnectionReasonDialog
                isOpen={connectionReasonDialogOpen}
                onClose={handleConnectionReasonCanceled}
                onConnect={handleConnectionReasonProvided}
                serverName={pendingConnection?.server?.name || "Unknown Server"}
            />
            {leftPaneSlot && createPortal(
                <ServerList setServerDialogOpen={(protocol = null) => {
                    setServerDialogProtocol(protocol);
                    setServerDialogOpen(true);
                }}
                            connectToServer={connectToServer}
                            setProxmoxDialogOpen={() => setProxmoxDialogOpen(true)}
                            setSSHConfigImportDialogOpen={() => setSSHConfigImportDialogOpen(true)}
                            setCurrentFolderId={setCurrentFolderId} setCurrentOrganizationId={setCurrentOrganizationId}
                            setEditServerId={setEditServerId} openSFTP={openSFTP}
                            hibernatedSessions={hibernatedSessions} resumeSession={resumeConnection}
                            openDirectConnect={openDirectConnect} runScript={runScript}
                            openNotes={openNotes}
                            openPortForward={isTauri() ? openPortForward : undefined}
                            mobileOpen={mobileServerListOpen} setMobileOpen={setMobileServerListOpen} />,
                leftPaneSlot
            )}
            {visibleSessions.length === 0 && 
                <WelcomePanel 
                    connectToServer={connectToServer} 
                    hibernatedSessions={hibernatedSessions} 
                    resumeSession={resumeConnection}
                    openSFTP={openSFTP}
                    openDirectConnect={openDirectConnect}
                />
            }
            {visibleSessions.length > 0 &&
                <ViewContainer activeSessions={visibleSessions} disconnectFromServer={disconnectFromServer}
                               closeSession={closeSession}
                               activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
                               hibernateSession={hibernateSession} duplicateSession={duplicateSession}
                               openNotes={openNotes}
                               markSessionErrored={markSessionErrored}
                               getSessionError={getSessionError}
                               setOpenFileEditors={setOpenFileEditors}
                               openTerminalFromFileManager={openTerminalFromFileManager} />}
            {openFileEditors.map((editor, index) => (
                editor.type === "preview" ? (
                    <FilePreviewWindow
                        key={editor.id}
                        file={editor.file}
                        session={editor.session}
                        onClose={() => setOpenFileEditors(prev => prev.filter(e => e.id !== editor.id))}
                    />
                ) : (
                    <FileEditorWindow
                        key={editor.id}
                        file={editor.file}
                        session={editor.session}
                        onClose={() => setOpenFileEditors(prev => prev.filter(e => e.id !== editor.id))}
                    />
                )
            ))}
        </div>
    );
};
