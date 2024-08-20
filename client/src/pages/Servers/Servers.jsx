import "./styles.sass";
import ServerList from "@/pages/Servers/components/ServerList";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useContext, useState } from "react";
import Button from "@/common/components/Button";
import WelcomeImage from "@/common/img/welcome.png";
import { GITHUB_URL } from "@/App.jsx";
import ServerDialog from "@/pages/Servers/components/ServerDialog";

export const Servers = () => {

    const [serverDialogOpen, setServerDialogOpen] = useState(false);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [editServerId, setEditServerId] = useState(null);
    const {user} = useContext(UserContext);

    const closeDialog = () => {
        setServerDialogOpen(false);
        setCurrentFolderId(null);
        setEditServerId(null);
    }

    return (
        <div className="server-page">
            <ServerDialog open={serverDialogOpen} onClose={closeDialog} currentFolderId={currentFolderId}
                            editServerId={editServerId}/>
            <ServerList setServerDialogOpen={() => setServerDialogOpen(true)}
                        setCurrentFolderId={setCurrentFolderId} setEditServerId={setEditServerId}/>
            <div className="welcome-area">
                <div className="area-left">
                    <h1>Hi, <span>{user?.firstName || "User"} {user?.lastName || "name"}</span>!</h1>
                    <p>Welcome to Nexterm. The open-source server manager for SSH, VNC and RDP.</p>
                    <Button text="Star on GitHub" onClick={() => window.open(GITHUB_URL, "_blank")} />
                </div>
                <img src={WelcomeImage} alt="Welcome" />
            </div>
        </div>
    )
}