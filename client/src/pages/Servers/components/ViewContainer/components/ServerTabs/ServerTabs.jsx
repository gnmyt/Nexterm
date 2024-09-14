import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext } from "react";
import Icon from "@mdi/react";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";
import { getIconByType} from "@/pages/Servers/components/ServerList/components/PVEObject/PVEObject.jsx";
import { mdiClose, mdiViewSplitVertical } from "@mdi/js";
import "./styles.sass";

export const ServerTabs = ({activeSessions, setActiveSessionId, activeSessionId, disconnectFromServer}) => {

    const {getServerById, getPVEContainerById} = useContext(ServerContext);

    return (
        <div className="server-tabs">
            <Icon path={mdiViewSplitVertical} onClick={() => alert("Not implemented yet")} />
            <div className="tabs">
                {activeSessions.map(session => {
                    let server = session.containerId === undefined ? getServerById(session.server) : getPVEContainerById(session.server, session.containerId);

                    return (
                        <div key={session.id} className={"server-tab" + (session.id === activeSessionId ? " server-tab-active" : "")}
                                onClick={() => setActiveSessionId(session.id)}>
                            <Icon path={server?.icon ? loadIcon(server.icon) : getIconByType(server?.type)} />
                            <h2>{server?.name} {session.type === "sftp" ? " (SFTP)" : ""}</h2>
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