import "./styles.sass";
import ServerTabs from "./components/ServerTabs";
import { useContext } from "react";
import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import GuacamoleRenderer from "@/pages/Servers/components/ViewContainer/renderer/GuacamoleRenderer.jsx";
import XtermRenderer from "@/pages/Servers/components/ViewContainer/renderer/XtermRenderer.jsx";

export const ViewContainer = ({activeSessions, activeSessionId, setActiveSessionId, disconnectFromServer}) => {

    const {getServerById} = useContext(ServerContext);
    return (
        <div className="view-container">
            <ServerTabs activeSessions={activeSessions} setActiveSessionId={setActiveSessionId}
                        activeSessionId={activeSessionId} disconnectFromServer={disconnectFromServer} />

            <div className="view-layouter">
                {activeSessions.map(session => {
                    const server = getServerById(session.server);
                    return (
                        <div key={session.id} className={"view" + (session.id === activeSessionId ? " view-active" : "")}>
                            {(server.protocol === "vnc" || server.protocol === "rdp") &&
                                <GuacamoleRenderer session={session} disconnectFromServer={disconnectFromServer} />}
                            {server.protocol === "ssh" && <XtermRenderer session={session} disconnectFromServer={disconnectFromServer} />}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}