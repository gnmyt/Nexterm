import "./styles.sass";
import ServerList from "@/pages/Servers/components/ServerList";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useContext, useState } from "react";
import Button from "@/common/components/Button";
import WelcomeImage from "@/common/img/welcome.png";
import { GITHUB_URL } from "@/App.jsx";
import ServerDialog from "@/pages/Servers/components/ServerDialog";
import ViewContainer from "@/pages/Servers/components/ViewContainer";

export const Servers = () => {

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [editServerId, setEditServerId] = useState(null);
    const {user} = useContext(UserContext);

    const [activeSessions, setActiveSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);

    const connectToServer = (server, identity) => {
        const sessionId = "session-" + (Math.random().toString(36).substring(2, 15))
        setActiveSessions(activeSessions => [...activeSessions, {server, identity, id: sessionId}]);

        setActiveSessionId(sessionId);
    }

    const connectToPVEServer = (serverId, containerId) => {
        const sessionId = "session-" + (Math.random().toString(36).substring(2, 15))
        setActiveSessions(activeSessions => [...activeSessions, {server: serverId, containerId: containerId, id: sessionId}]);

        setActiveSessionId(sessionId);
    }

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
    }

    const closeDialog = () => {
        setServerDialogOpen(false);
        setCurrentFolderId(null);
        setEditServerId(null);
    }

    return (
        <div className="server-page">
            <ServerDialog open={serverDialogOpen} onClose={closeDialog} currentFolderId={currentFolderId}
                            editServerId={editServerId}/>
            <ServerList setServerDialogOpen={() => setServerDialogOpen(true)} connectToServer={connectToServer}
                        connectToPVEServer={connectToPVEServer}
                        setCurrentFolderId={setCurrentFolderId} setEditServerId={setEditServerId}/>
            {activeSessions.length === 0 &&<div className="welcome-area">
                <div className="area-left">
                    <h1>Hi, <span>{user?.firstName || "User"} {user?.lastName || "name"}</span>!</h1>
                    <p>Welcome to Nexterm. The open-source server manager for SSH, VNC and RDP.</p>
                    <Button text="Star on GitHub" onClick={() => window.open(GITHUB_URL, "_blank")} />
                </div>
                <img src={WelcomeImage} alt="Welcome" />
            </div>}
            {activeSessions.length > 0 && <ViewContainer activeSessions={activeSessions} disconnectFromServer={disconnectFromServer}
                                              activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId} />}
        </div>
    )
}