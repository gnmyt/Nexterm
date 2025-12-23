import { useRef, useState, useEffect, useCallback, useContext } from "react";
import Icon from "@mdi/react";
import { loadIcon } from "@/pages/Servers/utils/iconMapping.js";
import { mdiClose, mdiViewSplitVertical, mdiChevronLeft, mdiChevronRight, mdiSleep, mdiOpenInNew, mdiShareVariant, mdiLinkVariant, mdiPencil, mdiEye, mdiCloseCircle, mdiContentDuplicate, mdiKey } from "@mdi/js";
import { IdentityContext } from "@/common/contexts/IdentityContext.jsx";
import { useTranslation } from "react-i18next";
import { useDrag, useDrop } from "react-dnd";
import TerminalActionsMenu from "../TerminalActionsMenu";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenu } from "@/common/components/ContextMenu";
import { useActiveSessions } from "@/common/contexts/SessionContext.jsx";
import { postRequest, deleteRequest, patchRequest } from "@/common/utils/RequestUtil";
import { getBaseUrl } from "@/common/utils/ConnectionUtil.js";
import "./styles.sass";

const DraggableTab = ({
    session,
    server,
    activeSessionId,
    setActiveSessionId,
    closeSession,
    hibernateSession,
    duplicateSession,
    index,
    moveTab,
    progress = 0,
    onShareUpdate,
}) => {
    const contextMenu = useContextMenu();
    const { identities } = useContext(IdentityContext);
    const { t } = useTranslation();
    const { popOutSession } = useActiveSessions();
    
    const canPopOut = !session.scriptId && session.type !== "sftp";
    const canShare = canPopOut;
    const isSharing = !!session.shareId;

    const handleShare = useCallback(async (writable) => {
        const result = await postRequest(`connections/${session.id}/share`, { writable });
        if (result?.shareId) {
            const baseUrl = getBaseUrl() || window.location.origin;
            navigator.clipboard.writeText(`${baseUrl}/share/${result.shareId}`);
        }
        onShareUpdate?.(session.id);
    }, [session.id, onShareUpdate]);

    const handleStopSharing = useCallback(async () => {
        await deleteRequest(`connections/${session.id}/share`);
        onShareUpdate?.(session.id);
    }, [session.id, onShareUpdate]);

    const handleCopyLink = useCallback(() => {
        const baseUrl = getBaseUrl() || window.location.origin;
        navigator.clipboard.writeText(`${baseUrl}/share/${session.shareId}`);
    }, [session.shareId]);

    const handlePermissionChange = useCallback(async (writable) => {
        await patchRequest(`connections/${session.id}/share`, { writable });
        onShareUpdate?.(session.id);
    }, [session.id, onShareUpdate]);
    
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
        contextMenu.open(e, { x: e.clientX, y: e.clientY });
    };

    return (
        <>
            <div ref={(node) => drag(drop(node))} onClick={() => setActiveSessionId(session.id)}
                onContextMenu={handleContextMenu}
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
                        closeSession(session.id);
                    }} />
                </div>
            </div>
            <ContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                onClose={contextMenu.close}
                trigger={contextMenu.triggerRef}
            >
                {canPopOut && (
                    <>
                        <ContextMenuItem
                            icon={mdiOpenInNew}
                            label="Pop Out"
                            onClick={() => popOutSession(session.id)}
                        />
                        <ContextMenuSeparator />
                    </>
                )}
                {canShare && !isSharing && (
                    <ContextMenuItem icon={mdiShareVariant} label="Start Sharing">
                        <ContextMenuItem icon={mdiEye} label="Read-only" onClick={() => handleShare(false)} />
                        <ContextMenuItem icon={mdiPencil} label="Read & Write" onClick={() => handleShare(true)} />
                    </ContextMenuItem>
                )}
                {canShare && isSharing && (
                    <>
                        <ContextMenuItem icon={mdiLinkVariant} label="Copy Share Link" onClick={handleCopyLink} />
                        <ContextMenuItem icon={mdiShareVariant} label="Change Permissions">
                            <ContextMenuItem icon={mdiEye} label="Read-only" onClick={() => handlePermissionChange(false)} disabled={!session.shareWritable} />
                            <ContextMenuItem icon={mdiPencil} label="Read & Write" onClick={() => handlePermissionChange(true)} disabled={session.shareWritable} />
                        </ContextMenuItem>
                        <ContextMenuItem icon={mdiCloseCircle} label="Stop Sharing" onClick={handleStopSharing} danger />
                        <ContextMenuSeparator />
                    </>
                )}
                <ContextMenuItem
                    icon={mdiContentDuplicate}
                    label="Duplicate"
                    onClick={() => duplicateSession(session.id)}
                />
                {(identities && session.identity && identities.find(i => i.id === session.identity) && ['password','both','password-only'].includes(identities.find(i => i.id === session.identity).type)) && (
                    <ContextMenuItem
                        icon={mdiKey}
                        label={t('servers.contextMenu.pasteIdentityPassword')}
                        onClick={async () => {
                            try {
                                await postRequest(`connections/${session.id}/paste-password`);
                            } catch (e) {
                                console.error('Failed to paste password', e);
                            }
                        }}
                    />
                )}
                <ContextMenuItem
                    icon={mdiSleep}
                    label="Hibernate Session"
                    onClick={() => hibernateSession(session.id)}
                />
                <ContextMenuItem
                    icon={mdiClose}
                    label="Close Session"
                    onClick={() => closeSession(session.id)}
                    danger
                />
            </ContextMenu>
        </>
    );
};

export const ServerTabs = ({
    activeSessions,
    setActiveSessionId,
    activeSessionId,
    closeSession,
    hibernateSession,
    duplicateSession,
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
    onShareUpdate,
}) => {

    const tabsRef = useRef(null);

    const [tabOrder, setTabOrder] = useState([]);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const activeSession = activeSessions.find(session => session.id === activeSessionId);

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
                    activeSession={activeSession}
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
                                closeSession={closeSession} hibernateSession={hibernateSession} duplicateSession={duplicateSession}
                                progress={sessionProgress[session.id] || 0} onShareUpdate={onShareUpdate} />
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