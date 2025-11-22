import "./styles.sass";
import ServerList from "@/pages/Servers/components/ServerList";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useContext, useEffect, useState } from "react";
import Button from "@/common/components/Button";
import WelcomeImage from "@/common/img/welcome.avif";
import { DISCORD_URL, GITHUB_URL } from "@/App.jsx";
import ServerDialog from "@/pages/Servers/components/ServerDialog";
import ViewContainer from "@/pages/Servers/components/ViewContainer";
import ProxmoxDialog from "@/pages/Servers/components/ProxmoxDialog";
import SSHConfigImportDialog from "@/pages/Servers/components/SSHConfigImportDialog";
import ConnectionReasonDialog from "@/pages/Servers/components/ConnectionReasonDialog";
import DirectConnectDialog from "@/pages/Servers/components/DirectConnectDialog";
import { mdiStar } from "@mdi/js";
import { siDiscord } from "simple-icons";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";

import { getRequest, postRequest, deleteRequest } from "@/common/utils/RequestUtil";

export const Servers = () => {

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [serverDialogProtocol, setServerDialogProtocol] = useState(null);
    const [proxmoxDialogOpen, setProxmoxDialogOpen] = useState(false);
    const [sshConfigImportDialogOpen, setSSHConfigImportDialogOpen] = useState(false);
    const [connectionReasonDialogOpen, setConnectionReasonDialogOpen] = useState(false);
    const [directConnectDialogOpen, setDirectConnectDialogOpen] = useState(false);
    const [directConnectServer, setDirectConnectServer] = useState(null);
    const [pendingConnection, setPendingConnection] = useState(null);

    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [currentOrganizationId, setCurrentOrganizationId] = useState(null);
    const [editServerId, setEditServerId] = useState(null);
    const { user } = useContext(UserContext);
    const { activeSessions, setActiveSessions, activeSessionId, setActiveSessionId } = useActiveSessions();
    const { getServerById, servers } = useContext(ServerContext);
    const location = useLocation();
    const navigate = useNavigate();

    const [hibernatedSessions, setHibernatedSessions] = useState([]);

    const fetchSessions = async () => {
        try {
            const sessions = await getRequest("/connections");
            const mappedSessions = sessions.map(session => {
                const server = getServerById(session.entryId);
                if (!server) return null;

                return {
                    id: session.sessionId,
                    server: server,
                    identity: session.configuration.identityId,
                    connectionReason: session.connectionReason,
                    isHibernated: session.isHibernated,
                    createdAt: session.createdAt,
                    lastActivity: session.lastActivity,
                    type: session.configuration.type || undefined
                };
            }).filter(s => s !== null);

            const activeMapped = mappedSessions.filter(s => !s.isHibernated);
            const hibernatedMapped = mappedSessions.filter(s => s.isHibernated);
            
            setActiveSessions(activeMapped);
            setHibernatedSessions(hibernatedMapped);

            if (activeMapped.length > 0) {
                if (!activeSessionId || !activeMapped.find(s => s.id === activeSessionId)) {
                    setActiveSessionId(activeMapped[activeMapped.length - 1].id);
                }
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        }
    };

    useEffect(() => {
        if (servers) {
            fetchSessions();
        }
    }, [servers]);

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

        const requiresReason = checkConnectionReasonRequired(serverId, servers);
        if (requiresReason) {
            setPendingConnection({ server: { ...server, renderer: overrideRenderer || server.renderer }, identity });
            setConnectionReasonDialogOpen(true);
            return;
        }

        performConnection({ ...server, renderer: overrideRenderer || server.renderer }, identity);
    };

    const openSFTP = async (server, identity) => {
        const serverObj = getServerById(server);
        const requiresReason = checkConnectionReasonRequired(server, servers);
        
        if (requiresReason) {
            setPendingConnection({ server: serverObj, identity, type: "sftp" });
            setConnectionReasonDialogOpen(true);
            return;
        }
        
        performConnection(serverObj, identity, null, "sftp");
    };

    const performConnection = async (server, identity, connectionReason = null, type = null, directIdentity = null) => {
        try {
            const payload = {
                entryId: server.id,
                identityId: identity?.id,
                connectionReason,
                type
            };

            if (directIdentity) payload.directIdentity = directIdentity;
            const session = await postRequest("/connections", payload);

            const sessionData = {
                server,
                identity: identity?.id,
                id: session.sessionId,
                connectionReason,
                type: type || undefined
            };

            setActiveSessions(prevSessions => [...prevSessions, sessionData]);
            setActiveSessionId(session.sessionId);
        } catch (error) {
            console.error("Failed to create session", error);
        }
    };

    const resumeConnection = async (sessionId) => {
        try {
            await postRequest(`/connections/${sessionId}/resume`);
            setActiveSessionId(sessionId);
            await fetchSessions();
        } catch (error) {
            console.error("Failed to resume session", error);
        }
    };

    const handleConnectionReasonProvided = (reason) => {
        if (pendingConnection) {
            performConnection(
                pendingConnection.server, 
                pendingConnection.identity,
                reason, 
                pendingConnection.type || null,
                pendingConnection.directIdentity || null
            );
            setPendingConnection(null);
        }
        setConnectionReasonDialogOpen(false);
    };

    const handleConnectionReasonCanceled = () => {
        setPendingConnection(null);
        setConnectionReasonDialogOpen(false);
    };

    const disconnectFromServer = async (sessionId) => {
        try {
            await deleteRequest(`/connections/${sessionId}`);
            setActiveSessions(activeSessions => {
                const newSessions = activeSessions.filter(session => session.id !== sessionId);

                if (newSessions.length === 0) {
                    setActiveSessionId(null);
                } else if (sessionId === activeSessionId) {
                    setActiveSessionId(newSessions[newSessions.length - 1].id);
                }

                return newSessions;
            });
        } catch (error) {
            console.error("Failed to delete session", error);
        }
    };

    const hibernateSession = async (sessionId) => {
        try {
            await postRequest(`/connections/${sessionId}/hibernate`);
            
            if (sessionId === activeSessionId) {
                const otherSessions = activeSessions.filter(s => s.id !== sessionId);
                if (otherSessions.length > 0) {
                    setActiveSessionId(otherSessions[otherSessions.length - 1].id);
                } else {
                    setActiveSessionId(null);
                }
            }
            
            await fetchSessions();
        } catch (error) {
            console.error("Failed to hibernate session", error);
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
        setDirectConnectServer(server);
        setDirectConnectDialogOpen(true);
    };

    const closeDirectConnectDialog = () => {
        setDirectConnectDialogOpen(false);
        setDirectConnectServer(null);
    };

    const handleDirectConnect = (directIdentity) => {
        if (!directConnectServer) return;

        const requiresReason = checkConnectionReasonRequired(directConnectServer.id, servers);
        if (requiresReason) {
            setPendingConnection({ 
                server: directConnectServer, 
                identity: null, 
                directIdentity 
            });
            setConnectionReasonDialogOpen(true);
        } else {
            performConnection(directConnectServer, null, null, null, directIdentity);
        }
    };

    useEffect(() => {
        if (!servers) return;

        const params = new URLSearchParams(location.search);
        const connectId = params.get("connectId");

        if (connectId) {
            navigate("/servers", { replace: true });

            const handleAutoConnect = async () => {
                const server = getServerById(connectId);
                const isPveEntry = server?.type?.startsWith('pve-');
                const hasIdentities = server?.identities && server.identities.length > 0;

                if (server && (isPveEntry || hasIdentities)) {
                    const identity = isPveEntry ? null : server.identities[0];
                    try {
                        const requiresReason = checkConnectionReasonRequired(connectId, servers);
                        if (requiresReason) {
                            setPendingConnection({ server, identity });
                            setConnectionReasonDialogOpen(true);
                        } else {
                            performConnection(server, identity);
                        }
                    } catch (error) {
                        performConnection(server, identity);
                    }
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
                openDirectConnect={openDirectConnect} />
            {activeSessions.length === 0 && <div className="welcome-area">
                <div className="area-left">
                    <h1>Hi, <span>{user?.firstName || "User"} {user?.lastName || "name"}</span>!</h1>
                    <p>Welcome to Nexterm. The open-source server manager for SSH, VNC and RDP.</p>
                    <div className="button-area">
                        <Button text="Star on GitHub" onClick={() => window.open(GITHUB_URL, "_blank")}
                            icon={mdiStar} />
                        <Button text="Join Discord" onClick={() => window.open(DISCORD_URL, "_blank")}
                            icon={siDiscord.path} />
                    </div>
                </div>
                <img src={WelcomeImage} alt="Welcome" />
            </div>}
            {activeSessions.length > 0 &&
                <ViewContainer activeSessions={activeSessions} disconnectFromServer={disconnectFromServer}
                    activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
                    hibernateSession={hibernateSession} />}
        </div>
    );
};