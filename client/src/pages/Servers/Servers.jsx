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
import { mdiStar } from "@mdi/js";
import { siDiscord } from "simple-icons";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";

export const Servers = () => {

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [proxmoxDialogOpen, setProxmoxDialogOpen] = useState(false);
    const [sshConfigImportDialogOpen, setSSHConfigImportDialogOpen] = useState(false);
    const [connectionReasonDialogOpen, setConnectionReasonDialogOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState(null);

    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [editServerId, setEditServerId] = useState(null);
    const { user } = useContext(UserContext);
    const { activeSessions, setActiveSessions, activeSessionId, setActiveSessionId } = useActiveSessions();
    const { getServerById, getPVEServerById, getPVEContainerById, servers } = useContext(ServerContext);
    const location = useLocation();
    const navigate = useNavigate();

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

    const connectToServer = async (server, identity) => {
        const requiresReason = checkConnectionReasonRequired(server, servers);
        if (requiresReason) {
            setPendingConnection({ type: "ssh", server, identity });
            setConnectionReasonDialogOpen(true);
            return;
        }

        performConnection("ssh", server, identity);
    };

    const openSFTP = async (server, identity) => {
        const requiresReason = checkConnectionReasonRequired(server, servers);
        if (requiresReason) {
            setPendingConnection({ type: "sftp", server, identity });
            setConnectionReasonDialogOpen(true);
            return;
        }

        performConnection("sftp", server, identity);
    };

    const performConnection = (type, server, identity, connectionReason = null) => {
        const sessionId = "session-" + (Math.random().toString(36).substring(2, 15));
        const sessionData = { server, identity, type, id: sessionId, connectionReason };

        setActiveSessions(prevSessions => [...prevSessions, sessionData]);
        setActiveSessionId(sessionId);
    };

    const handleConnectionReasonProvided = (reason) => {
        if (pendingConnection) {
            if (pendingConnection.type === "pve") {
                performPVEConnection(pendingConnection.serverId, pendingConnection.containerId, reason);
            } else {
                performConnection(pendingConnection.type, pendingConnection.server, pendingConnection.identity, reason);
            }
            setPendingConnection(null);
        }
        setConnectionReasonDialogOpen(false);
    };

    const handleConnectionReasonCanceled = () => {
        setPendingConnection(null);
        setConnectionReasonDialogOpen(false);
    };

    const connectToPVEServer = async (serverId, containerId) => {
        try {
            const pveServerId = serverId.toString().replace("pve-", "");
            const requiresReason = checkConnectionReasonRequired(pveServerId, servers);
            if (requiresReason) {
                setPendingConnection({ type: "pve", serverId, containerId });
                setConnectionReasonDialogOpen(true);
                return;
            }

            performPVEConnection(serverId, containerId);
        } catch (error) {
            performPVEConnection(serverId, containerId);
        }
    };

    const performPVEConnection = (serverId, containerId, connectionReason = null) => {
        const sessionId = "session-" + (Math.random().toString(36).substring(2, 15));
        const sessionData = {
            server: serverId.toString().replace("pve-", ""),
            containerId: containerId.toString().split("-")[containerId.toString().split("-").length - 1],
            id: sessionId,
            connectionReason,
        };

        setActiveSessions(activeSessions => [...activeSessions, sessionData]);
        setActiveSessionId(sessionId);
    };

    const disconnectFromServer = (sessionId) => {
        setActiveSessions(activeSessions => {
            const newSessions = activeSessions.filter(session => session.id !== sessionId);

            if (newSessions.length === 0) {
                setActiveSessionId(null);
            } else if (sessionId === activeSessionId) {
                setActiveSessionId(newSessions[newSessions.length - 1].id);
            }

            return newSessions;
        });
    };

    const closeDialog = () => {
        setServerDialogOpen(false);
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

    useEffect(() => {
        if (!servers) return;

        const params = new URLSearchParams(location.search);
        const connectId = params.get("connectId");

        if (connectId) {
            navigate("/servers", { replace: true });

            const handleAutoConnect = async () => {
                const server = getServerById(connectId);

                if (server && server.identities && server.identities.length > 0) {
                    try {
                        const requiresReason = checkConnectionReasonRequired(connectId, servers);
                        if (requiresReason) {
                            setPendingConnection({ type: "ssh", server: connectId, identity: server.identities[0] });
                            setConnectionReasonDialogOpen(true);
                        } else {
                            performConnection("ssh", connectId, server.identities[0]);
                        }
                    } catch (error) {
                        performConnection("ssh", connectId, server.identities[0]);
                    }
                } else {
                    const isPveServer = connectId.includes("-");

                    if (isPveServer) {
                        const [pveId, containerId] = connectId.split("-");
                        const pveServer = getPVEServerById(pveId);
                        const container = pveServer && containerId ?
                            getPVEContainerById(pveId, containerId) : null;

                        if (pveServer && container && container.status === "running") {
                            try {
                                const requiresReason = checkConnectionReasonRequired(pveId, servers);
                                if (requiresReason) {
                                    setPendingConnection({ type: "pve", serverId: pveId, containerId });
                                    setConnectionReasonDialogOpen(true);
                                } else {
                                    performPVEConnection(pveId, containerId);
                                }
                            } catch (error) {
                                performPVEConnection(pveId, containerId);
                            }
                        }
                    }
                }
            };

            handleAutoConnect();
        }
    }, [servers, location.search]);

    return (
        <div className="server-page">
            <ServerDialog open={serverDialogOpen} onClose={closeDialog} currentFolderId={currentFolderId}
                          editServerId={editServerId} />
            <ProxmoxDialog open={proxmoxDialogOpen} onClose={closePVEDialog}
                           currentFolderId={currentFolderId}
                           editServerId={editServerId} />
            <SSHConfigImportDialog open={sshConfigImportDialogOpen} onClose={closeSSHConfigImportDialog}
                                   currentFolderId={currentFolderId} />
            <ConnectionReasonDialog
                isOpen={connectionReasonDialogOpen}
                onClose={handleConnectionReasonCanceled}
                onConnect={handleConnectionReasonProvided}
                serverName={pendingConnection ? (
                    pendingConnection.type === "pve"
                        ? getPVEServerById(pendingConnection.serverId.toString().replace("pve-", ""))?.name || "Unknown Server"
                        : getServerById(pendingConnection.server)?.name || "Unknown Server"
                ) : ""}
            />
            <ServerList setServerDialogOpen={() => setServerDialogOpen(true)} connectToServer={connectToServer}
                        connectToPVEServer={connectToPVEServer} setProxmoxDialogOpen={() => setProxmoxDialogOpen(true)}
                        setSSHConfigImportDialogOpen={() => setSSHConfigImportDialogOpen(true)}
                        setCurrentFolderId={setCurrentFolderId} setEditServerId={setEditServerId} openSFTP={openSFTP} />
            {activeSessions.length === 0 && <div className="welcome-area">
                <div className="area-left">
                    <h1>Hi, <span>{user?.firstName || "User"} {user?.lastName || "name"}</span>!</h1>
                    <p>Welcome to Nexterm. The open-source server manager for SSH, VNC and RDP.</p>
                    <div className="button-area">
                        <Button text="Star on GitHub" onClick={() => window.open(GITHUB_URL, "_blank")} icon={mdiStar} />
                        <Button text="Join Discord" onClick={() => window.open(DISCORD_URL, "_blank")} icon={siDiscord.path} />
                    </div>
                </div>
                <img src={WelcomeImage} alt="Welcome" />
            </div>}
            {activeSessions.length > 0 &&
                <ViewContainer activeSessions={activeSessions} disconnectFromServer={disconnectFromServer}
                               activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId} />}
        </div>
    );
};