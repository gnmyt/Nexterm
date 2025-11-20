import { useRef, useState, useEffect } from "react";
import Icon from "@mdi/react";
import { loadIcon } from "@/pages/Servers/components/ServerList/components/ServerObject/ServerObject.jsx";
import { mdiClose, mdiViewSplitVertical, mdiChevronLeft, mdiChevronRight } from "@mdi/js";
import { useDrag, useDrop } from "react-dnd";
import TerminalActionsMenu from "../TerminalActionsMenu";
import "./styles.sass";

const DraggableTab = ({
                          session,
                          server,
                          activeSessionId,
                          setActiveSessionId,
                          disconnectFromServer,
                          index,
                          moveTab,
                          progress = 0,
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

    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;
    const showProgress = progress > 0 && progress < 100;

    return (
        <div ref={(node) => drag(drop(node))} onClick={() => setActiveSessionId(session.id)}
             className={`server-tab ${session.id === activeSessionId ? "server-tab-active" : ""} ${isDragging ? "dragging" : ""} ${isOver ? "drop-target" : ""}`}
             style={{ opacity: isDragging ? 0.5 : 1 }}>
            <div className={`progress-circle ${!showProgress ? "no-progress" : ""}`}>
                {showProgress && (
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <circle
                            cx="12"
                            cy="12"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="progress-bg"
                        />
                        <circle
                            cx="12"
                            cy="12"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="progress-bar"
                            transform="rotate(-90 12 12)"
                        />
                    </svg>
                )}
                <Icon path={loadIcon(server.icon)} className="progress-icon" />
            </div>
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
                               onBroadcastToggle,
                               onSnippetSelected,
                               broadcastEnabled,
                               onKeyboardShortcut,
                               hasGuacamole,
                               sessionProgress = {},
                               fullscreenEnabled,
                               onFullscreenToggle,
                           }) => {

    const tabsRef = useRef(null);

    const [tabOrder, setTabOrder] = useState([]);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

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

    const checkScrollPosition = () => {
        if (!tabsRef.current) return;

        const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    };

    useEffect(() => {
        checkScrollPosition();
        const handleResize = () => checkScrollPosition();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [activeSessions, tabOrder]);

    const handleWheel = (e) => {
        e.preventDefault();

        if (tabsRef.current) {
            tabsRef.current.scrollLeft += e.deltaY;
            checkScrollPosition();
        }
    };

    const scrollTabs = (direction) => {
        if (!tabsRef.current) return;

        const scrollAmount = 200;
        const targetScroll = tabsRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);

        tabsRef.current.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
        });

        setTimeout(checkScrollPosition, 300);
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
                <TerminalActionsMenu 
                    layoutMode={layoutMode}
                    onBroadcastToggle={onBroadcastToggle}
                    onSnippetSelected={onSnippetSelected}
                    broadcastEnabled={broadcastEnabled}
                    onKeyboardShortcut={onKeyboardShortcut}
                    hasGuacamole={hasGuacamole}
                    fullscreenEnabled={fullscreenEnabled}
                    onFullscreenToggle={onFullscreenToggle}
                />
                <Icon path={mdiViewSplitVertical} className={`layout-btn ${layoutMode !== "single" ? "active" : ""}`}
                      title={layoutMode === "single" ? "Enable Split View" : "Disable Split View"}
                      onClick={onToggleSplit} />
            </div>
            <div className="tabs-container">
                {showLeftArrow && (
                    <div className="scroll-indicator left" onClick={() => scrollTabs('left')}>
                        <Icon path={mdiChevronLeft} />
                    </div>
                )}
                <div className="tabs" ref={tabsRef} onWheel={handleWheel} onScroll={checkScrollPosition}>
                    {orderedSessions.map((session, index) => {
                        return (
                            <DraggableTab key={session.id} session={session} server={session.server} index={index} moveTab={moveTab}
                                          activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
                                          disconnectFromServer={disconnectFromServer} progress={sessionProgress[session.id] || 0} />
                        );
                    })}
                </div>
                {showRightArrow && (
                    <div className="scroll-indicator right" onClick={() => scrollTabs('right')}>
                        <Icon path={mdiChevronRight} />
                    </div>
                )}
            </div>
        </div>
    );
};