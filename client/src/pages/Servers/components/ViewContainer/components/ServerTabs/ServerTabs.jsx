import { ServerContext } from "@/common/contexts/ServerContext.jsx";
import { useContext, useRef, useState, useEffect } from "react";
import Icon from "@mdi/react";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";
import { getIconByType } from "@/pages/Servers/components/ServerList/components/PVEObject/PVEObject.jsx";
import { mdiClose, mdiViewSplitVertical } from "@mdi/js";
import { useDrag, useDrop } from "react-dnd";
import "./styles.sass";

const DraggableTab = ({
                          session,
                          server,
                          activeSessionId,
                          setActiveSessionId,
                          disconnectFromServer,
                          index,
                          moveTab,
                      }) => {
    const [{ isDragging }, drag] = useDrag({
        type: "TAB",
        item: { index, sessionId: session.id },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    });

    const [{ isOver }, drop] = useDrop({
        accept: "TAB",
        drop: (draggedItem) => {
            if (draggedItem.index !== index) moveTab(draggedItem.index, index);
        },
        collect: (monitor) => ({ isOver: monitor.isOver() }),
    });

    return (
        <div ref={(node) => drag(drop(node))} onClick={() => setActiveSessionId(session.id)}
             className={`server-tab ${session.id === activeSessionId ? "server-tab-active" : ""} ${isDragging ? "dragging" : ""} ${isOver ? "drop-target" : ""}`}
             style={{ opacity: isDragging ? 0.5 : 1 }}>
            <Icon path={server?.icon ? loadIcon(server.icon) : getIconByType(server?.type)} />
            <h2>{server?.name} {session.type === "sftp" ? " (SFTP)" : ""}</h2>
            <div className="tab-actions">
                <Icon path={mdiClose} className="close-btn" title="Close Session" onClick={(e) => {
                    e.stopPropagation();
                    disconnectFromServer(session.id);
                }} />
            </div>
        </div>
    );
};

export const ServerTabs = ({
                               activeSessions,
                               setActiveSessionId,
                               activeSessionId,
                               disconnectFromServer,
                               layoutMode,
                               onToggleSplit,
                               orderRef,
                               onTabOrderChange,
                           }) => {

    const { getServerById, getPVEContainerById } = useContext(ServerContext);
    const tabsRef = useRef(null);

    const [tabOrder, setTabOrder] = useState([]);

    useEffect(() => {
        const currentSessionIds = activeSessions.map(session => session.id);
        const orderSessionIds = tabOrder.map(id => id);
        const sessionsChanged = currentSessionIds.length !== orderSessionIds.length ||
            currentSessionIds.some(id => !orderSessionIds.includes(id)) ||
            orderSessionIds.some(id => !currentSessionIds.includes(id));

        if (sessionsChanged) {
            const newOrder = [];

            tabOrder.forEach(sessionId => {
                if (currentSessionIds.includes(sessionId)) newOrder.push(sessionId);
            });

            currentSessionIds.forEach(sessionId => {
                if (!newOrder.includes(sessionId)) newOrder.push(sessionId);
            });

            setTabOrder(newOrder);

            if (orderRef) orderRef.current = newOrder;
            if (onTabOrderChange) onTabOrderChange(newOrder);
        }
    }, [activeSessions, tabOrder, orderRef]);

    useEffect(() => {
        if (orderRef && tabOrder.length > 0) orderRef.current = tabOrder;
    }, [tabOrder, orderRef]);

    const handleWheel = (e) => {
        e.preventDefault();

        if (tabsRef.current) tabsRef.current.scrollLeft += e.deltaY;
    };

    const moveTab = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= tabOrder.length || toIndex < 0 || toIndex >= tabOrder.length) return;

        const newOrder = [...tabOrder];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);

        setTabOrder(newOrder);

        if (orderRef) orderRef.current = newOrder;
        if (onTabOrderChange) onTabOrderChange(newOrder);
    };

    const orderedSessions = tabOrder.map(sessionId => activeSessions.find(session => session.id === sessionId)).filter(Boolean);

    return (
        <div className="server-tabs">
            <div className="layout-controls">
                <Icon path={mdiViewSplitVertical} className={`layout-btn ${layoutMode !== "single" ? "active" : ""}`}
                      title={layoutMode === "single" ? "Enable Split View" : "Disable Split View"}
                      onClick={onToggleSplit} />
            </div>
            <div className="tabs" ref={tabsRef} onWheel={handleWheel}>
                {orderedSessions.map((session, index) => {
                    let server = session.containerId === undefined ? getServerById(session.server) : getPVEContainerById(session.server, session.containerId);

                    return (
                        <DraggableTab key={session.id} session={session} server={server} index={index} moveTab={moveTab}
                                      activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
                                      disconnectFromServer={disconnectFromServer} />
                    );
                })}
            </div>
        </div>
    );
};