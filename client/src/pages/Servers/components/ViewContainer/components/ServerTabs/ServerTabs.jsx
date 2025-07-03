import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext, useRef } from "react";
import Icon from "@mdi/react";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";
import { getIconByType } from "@/pages/Servers/components/ServerList/components/PVEObject/PVEObject.jsx";
import { mdiClose, mdiViewSplitVertical } from "@mdi/js";
import "./styles.sass";

export const ServerTabs = ({
                               activeSessions,
                               setActiveSessionId,
                               activeSessionId,
                               disconnectFromServer,
                               layoutMode,
                               onToggleSplit,
                           }) => {

    const { getServerById, getPVEContainerById } = useContext(ServerContext);
    const tabsRef = useRef(null);

    const handleWheel = (e) => {
        e.preventDefault();

        if (tabsRef.current) tabsRef.current.scrollLeft += e.deltaY;
    };

    return (
        <div className="server-tabs">
            <div className="layout-controls">
                <Icon path={mdiViewSplitVertical} className={`layout-btn ${layoutMode !== "single" ? "active" : ""}`}
                      title={layoutMode === "single" ? "Enable Split View" : "Disable Split View"}
                      onClick={onToggleSplit} />
            </div>
            <div className="tabs" ref={tabsRef} onWheel={handleWheel}>
                {activeSessions.map(session => {
                    let server = session.containerId === undefined ? getServerById(session.server) : getPVEContainerById(session.server, session.containerId);

                    return (
                        <div key={session.id}
                             className={"server-tab" + (session.id === activeSessionId ? " server-tab-active" : "")}
                             onClick={() => setActiveSessionId(session.id)}>
                            <Icon path={server?.icon ? loadIcon(server.icon) : getIconByType(server?.type)} />
                            <h2>{server?.name} {session.type === "sftp" ? " (SFTP)" : ""}</h2>
                            <Icon path={mdiClose} onClick={(e) => {
                                e.stopPropagation();
                                disconnectFromServer(session.id);
                            }} />
                        </div>
                    );
                })}
            </div>
        </div>

    );
};