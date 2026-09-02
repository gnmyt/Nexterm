import { useRef, useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiClose, mdiViewSplitVertical, mdiChevronLeft, mdiChevronRight, mdiMenu, mdiFullscreen, mdiFullscreenExit, mdiNoteEditOutline } from "@mdi/js";
import { useDrag, useDrop } from "react-dnd";
import { useContextMenu } from "@/common/components/ContextMenu";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";
import { useLiveSessions } from "@/common/contexts/LiveSessionContext.jsx";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import { useKeymaps, matchesKeybind } from "@/common/contexts/KeymapContext.jsx";
import AvatarStack from "@/common/components/AvatarStack";
import { getIconPath } from "@/common/utils/iconUtils.js";
import SessionMenu from "../SessionMenu";
import RemoteSessionStrip from "../RemoteSessionStrip";
import KeyboardShortcutsMenu from "../KeyboardShortcutsMenu";
import SnippetsMenu from "../../renderer/components/SnippetsMenu";
import "./styles.sass";

const DraggableTab = ({
    session,
    server,
    activeSessionId,
    setActiveSessionId,
    closeSession,
    onOpenMenu,
    index,
    moveTab,
    progress = 0,
    pageInfo = null,
}) => {
    const { getParticipants } = useLiveSessions();
    const { user } = useContext(UserContext);
    const { t } = useTranslation();

    const otherParticipants = getParticipants(session.joinSessionId || session.id)
        .filter(participant => participant.accountId !== user?.id);

    const isNotes = session.type === "notes";

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

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenMenu(e, session.id, { x: e.clientX, y: e.clientY });
    };

    const handleAuxClick = (e) => {
        if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            closeSession(session.id);
        }
    };

    return (
        <div ref={(node) => drag(drop(node))} onClick={() => setActiveSessionId(session.id)}
            onContextMenu={handleContextMenu}
            onAuxClick={handleAuxClick}
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
                {pageInfo?.icon
                    ? <img src={pageInfo.icon} className="progress-icon page-favicon" alt="" />
                    : <Icon path={isNotes ? mdiNoteEditOutline : getIconPath(server.icon)} className="progress-icon" />}
            </div>
            <h2>{pageInfo?.title || server?.name} {session.type === "sftp" ? " (SFTP)" : ""}{isNotes ? ` (${t("servers.notesPanel.title")})` : ""}</h2>
            <AvatarStack className="tab-participants" users={otherParticipants} max={2}
                         getKey={participant => participant.viewerId} />
            <div className="tab-actions">
                <Icon path={mdiClose} className="close-btn" title="Close Session" onClick={(e) => {
                    e.stopPropagation();
                    closeSession(session.id);
                }} />
            </div>
        </div>
    );
};

export const ServerTabs = ({
    activeSessions,
    setActiveSessionId,
    activeSessionId,
    closeSession,
    hibernateSession,
    duplicateSession,
    openNotes,
    layoutMode,
    onToggleSplit,
    onSplitSession,
    orderRef,
    onBroadcastToggle,
    onSnippetSelected,
    broadcastEnabled,
    activeControls,
    sessionProgress = {},
    sessionPageInfo = {},
    fullscreenEnabled,
    onFullscreenToggle,
    reveal = false,
}) => {

    const tabsRef = useRef(null);
    const { t } = useTranslation();
    const { popOutSession } = useActiveSessions();
    const { getParsedKeybind } = useKeymaps();
    const menu = useContextMenu();

    const [tabOrder, setTabOrder] = useState([]);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const [menuSessionId, setMenuSessionId] = useState(null);
    const [showSnippets, setShowSnippets] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    const activeSession = activeSessions.find(session => session.id === activeSessionId);
    const menuSession = activeSessions.find(session => session.id === menuSessionId) || null;
    const pinned = menu.isOpen || showSnippets || showShortcuts || (activeControls?.heldModifiers.size ?? 0) > 0;

    const openMenu = (event, sessionId, position) => {
        setMenuSessionId(sessionId);
        menu.open(event, position);
    };

    const openActiveMenu = (event) => {
        if (!activeSession) return;
        event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        openMenu(event, activeSession.id, { x: bounds.left, y: bounds.bottom + 6 });
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            const snippetsKeybind = getParsedKeybind("snippets");
            if (snippetsKeybind && matchesKeybind(event, snippetsKeybind)) {
                event.preventDefault();
                setShowSnippets(true);
                return;
            }

            const shortcutsKeybind = getParsedKeybind("keyboard-shortcuts");
            if (activeControls && shortcutsKeybind && matchesKeybind(event, shortcutsKeybind)) {
                event.preventDefault();
                setShowShortcuts(true);
                return;
            }

            const fullscreenKeybind = getParsedKeybind("fullscreen");
            if (fullscreenKeybind && matchesKeybind(event, fullscreenKeybind)) {
                event.preventDefault();
                onFullscreenToggle?.();
            }
        };

        const handleSnippetsEvent = () => setShowSnippets(true);
        const handleShortcutsEvent = () => activeControls && setShowShortcuts(true);

        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("terminal-snippets-shortcut", handleSnippetsEvent);
        window.addEventListener("terminal-keyboard-shortcuts-shortcut", handleShortcutsEvent);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("terminal-snippets-shortcut", handleSnippetsEvent);
            window.removeEventListener("terminal-keyboard-shortcuts-shortcut", handleShortcutsEvent);
        };
    }, [getParsedKeybind, activeControls, onFullscreenToggle]);

    const handleSnippetSelect = (command) => {
        setShowSnippets(false);
        setTimeout(() => onSnippetSelected?.(command), 50);
    };

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

        const tabs = tabsRef.current;
        if (!tabs) return;

        const observer = new ResizeObserver(() => checkScrollPosition());
        observer.observe(tabs);
        for (const child of tabs.children) observer.observe(child);

        return () => observer.disconnect();
    }, [activeSessions, tabOrder]);

    useEffect(() => {
        const tabs = tabsRef.current;
        if (!tabs) return;

        const handleWheel = (e) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            if (tabs.scrollWidth <= tabs.clientWidth) return;

            e.preventDefault();
            tabs.scrollLeft += e.deltaY;
        };

        tabs.addEventListener('wheel', handleWheel, { passive: false });
        return () => tabs.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        const activeTab = tabsRef.current?.querySelector('.server-tab-active');
        activeTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, [activeSessionId, tabOrder]);

    const scrollTabs = (direction) => {
        if (!tabsRef.current) return;

        const scrollAmount = Math.max(120, tabsRef.current.clientWidth * 0.8);
        const targetScroll = tabsRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);

        tabsRef.current.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
        });
    };

    const moveTab = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= tabOrder.length || toIndex < 0 || toIndex >= tabOrder.length) return;

        const newOrder = [...tabOrder];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);

        setTabOrder(newOrder);

        if (orderRef) orderRef.current = newOrder;
    };

    const orderedSessions = tabOrder.map(sessionId => activeSessions.find(session => session.id === sessionId)).filter(Boolean);

    const canSplitSession = (session) => activeSessions.length > 1 && session.id !== activeSessionId;

    return (
        <>
            {reveal && <div className="server-tabs-reveal-zone" />}
            <div className={`server-tabs${reveal ? " revealed" : ""}${pinned ? " pinned" : ""}`}>
                <div className="layout-controls">
                    <Icon path={mdiMenu} className={`layout-btn ${menu.isOpen ? "active" : ""}`}
                        title={t("servers.tabs.sessionMenu")}
                        onClick={openActiveMenu} />
                    <Icon path={mdiViewSplitVertical} className={`layout-btn split-btn ${layoutMode !== "single" ? "active" : ""}`}
                        title={layoutMode === "single" ? t("servers.tabs.enableSplitView") : t("servers.tabs.disableSplitView")}
                        onClick={onToggleSplit} />
                    <Icon path={fullscreenEnabled ? mdiFullscreenExit : mdiFullscreen}
                        className={`layout-btn fullscreen-btn ${fullscreenEnabled ? "active" : ""}`}
                        title={fullscreenEnabled ? t("servers.terminalActions.exitFullScreen") : t("servers.terminalActions.fullScreen")}
                        onClick={onFullscreenToggle} />
                </div>
                <div className="tabs-container">
                    {showLeftArrow && (
                        <div className="scroll-indicator left">
                            <button type="button" aria-label="Scroll tabs left" onClick={() => scrollTabs('left')}>
                                <Icon path={mdiChevronLeft} />
                            </button>
                        </div>
                    )}
                    <div className="tabs" ref={tabsRef} onScroll={checkScrollPosition} data-tauri-drag-region>
                        {orderedSessions.map((session, index) => (
                            <DraggableTab key={session.id} session={session} server={session.server} index={index} moveTab={moveTab}
                                activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
                                closeSession={closeSession} onOpenMenu={openMenu}
                                progress={sessionProgress[session.id] || 0}
                                pageInfo={sessionPageInfo[session.id] || null} />
                        ))}
                    </div>
                    {showRightArrow && (
                        <div className="scroll-indicator right">
                            <button type="button" aria-label="Scroll tabs right" onClick={() => scrollTabs('right')}>
                                <Icon path={mdiChevronRight} />
                            </button>
                        </div>
                    )}
                </div>
                {activeControls && <RemoteSessionStrip controls={activeControls} />}
            </div>

            <SessionMenu menu={menu} session={menuSession} controls={activeControls}
                         isActive={menuSession?.id === activeSessionId}
                         canSplit={!!menuSession && canSplitSession(menuSession)}
                         layoutMode={layoutMode} broadcastEnabled={broadcastEnabled}
                         fullscreenEnabled={fullscreenEnabled} onFullscreenToggle={onFullscreenToggle}
                         onBroadcastToggle={onBroadcastToggle}
                         onOpenSnippets={() => setShowSnippets(true)}
                         onOpenShortcuts={() => setShowShortcuts(true)}
                         onSplitSession={onSplitSession} onPopOut={popOutSession}
                         onOpenNotes={openNotes} onDuplicate={duplicateSession}
                         onHibernate={hibernateSession} onCloseSession={closeSession} />

            <SnippetsMenu visible={showSnippets} onClose={() => setShowSnippets(false)}
                          onSelect={handleSnippetSelect} activeSession={activeSession} />

            <KeyboardShortcutsMenu visible={showShortcuts} onClose={() => setShowShortcuts(false)}
                                   onSelect={(keys) => activeControls?.sendShortcut(keys)} />
        </>
    );
};
