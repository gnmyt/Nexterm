import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext } from "react";
import Icon from "@mdi/react";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";
import { mdiClose, mdiViewSplitVertical } from "@mdi/js";
import "./styles.sass";

export const ServerTabs = ({activeSessions, setActiveSessionId, activeSessionId, disconnectFromServer}) => {

    const {getServerById} = useContext(ServerContext);

    return (
        <div className="server-tabs">
            <Icon path={mdiViewSplitVertical} onClick={() => alert("Not implemented yet")} />
            <div className="tabs">
                {activeSessions.map(session => {
                    const server = getServerById(session.server);
                    return (
                        <div key={session.id} className={"server-tab" + (session.id === activeSessionId ? " server-tab-active" : "")}
                                onClick={() => setActiveSessionId(session.id)}>
                            <Icon path={loadIcon(server.icon)} />
                            <h2>{server.name}</h2>
                            <Icon path={mdiClose} onClick={(e) => {
                                e.stopPropagation();
                                disconnectFromServer(session.id);
                            }} />
                        </div>
                    )
                })}
            </div>
        </div>

    )
}