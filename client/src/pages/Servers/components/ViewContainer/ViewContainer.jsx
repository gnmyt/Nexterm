import "./styles.sass";
import ServerTabs from "./components/ServerTabs";
import { useContext } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";
import FileRenderer from "@/pages/Servers/components/ViewContainer/renderer/FileRenderer/index.js";

export const ViewContainer = ({activeSessions, activeSessionId, setActiveSessionId, disconnectFromServer}) => {

    const {getServerById, getPVEContainerById} = useContext(ServerContext);
    return (
        <div className="view-container">
            <ServerTabs activeSessions={activeSessions} setActiveSessionId={setActiveSessionId}
                        activeSessionId={activeSessionId} disconnectFromServer={disconnectFromServer} />

            <div className="view-layouter">
                {activeSessions.map(session => {
                    const isPVE = session.containerId !== undefined;
                    const server = session.containerId !== undefined ? getPVEContainerById(session.server, session.containerId) : getServerById(session.server);

                    if (!server) return null;

                    return (
                        <div key={session.id} className={"view" + (session.id === activeSessionId ? " view-active" : "")}>
                            {(server.protocol === "vnc" || server.protocol === "rdp") &&
                                <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer} />}
                            {server.protocol === "ssh" && session.type === "ssh"
                                && <XtermRenderer session={session} disconnectFromServer={disconnectFromServer} />}

                            {server.protocol === "ssh" && session.type === "sftp"
                                && <FileRenderer session={session} disconnectFromServer={disconnectFromServer} />}

                            {isPVE && server.type === "pve-qemu" &&
                                <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer} pve />}

                            {isPVE && (server.type === "pve-shell" || server.type === "pve-lxc") &&
                                <XtermRenderer session={session} disconnectFromServer={disconnectFromServer} pve />}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}