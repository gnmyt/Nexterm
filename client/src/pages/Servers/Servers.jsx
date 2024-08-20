import "./styles.sass";
import ServerList from "@/pages/Servers/components/ServerList";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useContext } from "react";
import Button from "@/common/components/Button";
import WelcomeImage from "@/common/img/welcome.png";
import { GITHUB_URL } from "@/App.jsx";

export const Servers = () => {

    const {user} = useContext(UserContext);

    return (
        <div className="server-page">
            <ServerList />
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